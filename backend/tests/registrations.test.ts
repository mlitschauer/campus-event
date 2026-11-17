import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  createSession,
  revokeSession,
} from '../src/services/sessionService.ts'

const ORIGIN = 'http://localhost:5173'

type TestRole = 'student' | 'organizer'

Deno.test(
  'CE-24: Teilnehmeranmeldungen und Kapazitätsprüfung',
  async (t) => {
    const userIds: string[] = []
    const eventIds: string[] = []
    const tokens: string[] = []

    const createTestUser = async (
      role: TestRole,
    ): Promise<string> => {
      const email =
        `ce24-${role}-${crypto.randomUUID()}@campusevent.example`

      const rows = await sql<{ id: string }[]>`
        INSERT INTO users (
          name,
          email,
          password_hash,
          role
        )
        VALUES (
          'CE24 Integrationstest',
          ${email},
          '!CE24_LOGIN_DISABLED!',
          ${role}
        )
        RETURNING id
      `

      assert.ok(rows[0])

      userIds.push(rows[0].id)
      return rows[0].id
    }

    const request = (
      method: 'GET' | 'POST' | 'DELETE',
      path: string,
      token?: string,
      body?: unknown,
    ) => {
      const headers: Record<string, string> = {
        Origin: ORIGIN,
      }

      if (token) {
        headers.Cookie =
          `campus_event_session=${token}`
      }

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }

      return app.request(path, {
        method,
        headers,
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      })
    }

    try {
      const categories = await sql<{ id: string }[]>`
        SELECT id
        FROM categories
        LIMIT 1
      `

      assert.ok(
        categories[0],
        'Keine Kategorie vorhanden. Bitte Seed-Daten prüfen.',
      )

      const organizer = await createTestUser('organizer')
      const studentA = await createTestUser('student')
      const studentB = await createTestUser('student')
      const studentC = await createTestUser('student')

      const organizerSession = await createSession(organizer)
      const sessionA = await createSession(studentA)
      const sessionB = await createSession(studentB)
      const sessionC = await createSession(studentC)

      tokens.push(
        organizerSession.token,
        sessionA.token,
        sessionB.token,
        sessionC.token,
      )

      const startsAt = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      )

      const endsAt = new Date(
        startsAt.getTime() + 2 * 60 * 60 * 1000,
      )

      const createDraft = async (
        title: string,
        capacity: number,
      ): Promise<string> => {
        const response = await request(
          'POST',
          '/api/events',
          organizerSession.token,
          {
            title,
            description:
              'Automatisch erstellte Veranstaltung zum Testen von Teilnehmeranmeldungen.',
            location: 'Campus Mosbach',
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            capacity,
            categoryId: categories[0].id,
          },
        )

        assert.equal(response.status, 201)

        const data = await response.json()
        const id: string = data.event.id

        eventIds.push(id)
        return id
      }

      const eventId = await createDraft(
        'CE24 Anmeldungstest',
        2,
      )

      const registerPath =
        `/api/events/${eventId}/registrations`

      const unregisterPath =
        `/api/events/${eventId}/registrations/me`

      // Test 1
      await t.step('Gast darf sich nicht anmelden', async () => {
        const response = await request(
          'POST',
          registerPath,
        )

        assert.equal(response.status, 401)
      })

      // Test 2
      await t.step('Organizer darf sich nicht anmelden', async () => {
        const response = await request(
          'POST',
          registerPath,
          organizerSession.token,
        )

        assert.equal(response.status, 403)
      })

      // Test 3
      await t.step('Fremde Origin wird abgelehnt', async () => {
        const response = await app.request(registerPath, {
          method: 'POST',
          headers: {
            Origin: 'https://untrusted.example',
            Cookie:
              `campus_event_session=${sessionA.token}`,
          },
        })

        assert.equal(response.status, 403)
      })

      // Test 4
      await t.step('Ungültige UUID liefert 400', async () => {
        const response = await request(
          'POST',
          '/api/events/abc/registrations',
          sessionA.token,
        )

        assert.equal(response.status, 400)
      })

      // Test 5
      await t.step('Entwurf erlaubt keine Anmeldung', async () => {
        const response = await request(
          'POST',
          registerPath,
          sessionA.token,
        )

        assert.equal(response.status, 409)

        const data = await response.json()
        assert.equal(data.error.code, 'EVENT_NOT_OPEN')
      })

      // Event für die weiteren Tests veröffentlichen
      const publishResponse = await request(
        'POST',
        `/api/events/${eventId}/publish`,
        organizerSession.token,
      )

      assert.equal(publishResponse.status, 200)

      // Test 6
      await t.step('Student A meldet sich erfolgreich an', async () => {
        const response = await request(
          'POST',
          registerPath,
          sessionA.token,
        )

        assert.equal(response.status, 201)

        const data = await response.json()

        assert.equal(data.registration.eventId, eventId)
        assert.equal(data.registration.userId, studentA)
        assert.equal(typeof data.registration.id, 'string')
      })

      // Test 7
      await t.step('Doppelte Anmeldung wird abgelehnt', async () => {
        const response = await request(
          'POST',
          registerPath,
          sessionA.token,
        )

        assert.equal(response.status, 409)

        const data = await response.json()
        assert.equal(data.error.code, 'ALREADY_REGISTERED')
      })

      // Test 8
      await t.step('Student B belegt zweiten Platz', async () => {
        const response = await request(
          'POST',
          registerPath,
          sessionB.token,
        )

        assert.equal(response.status, 201)
      })

      // Test 9
      await t.step('Volles Event lehnt Student C ab', async () => {
        const response = await request(
          'POST',
          registerPath,
          sessionC.token,
        )

        assert.equal(response.status, 409)

        const data = await response.json()
        assert.equal(data.error.code, 'EVENT_FULL')
      })

      // Test 10
      await t.step('Kapazität wird in PostgreSQL eingehalten', async () => {
        const rows = await sql<{ total: number }[]>`
          SELECT COUNT(*)::integer AS total
          FROM registrations
          WHERE event_id = ${eventId}::uuid
        `

        assert.equal(rows[0].total, 2)
      })

      // Test 11
      await t.step('Student A kann sich abmelden', async () => {
        const response = await request(
          'DELETE',
          unregisterPath,
          sessionA.token,
        )

        assert.equal(response.status, 204)
        assert.equal(await response.text(), '')
      })

      // Test 12
      await t.step('Wiederholte Abmeldung liefert 404', async () => {
        const response = await request(
          'DELETE',
          unregisterPath,
          sessionA.token,
        )

        assert.equal(response.status, 404)
      })

      // Test 13
      await t.step('Frei gewordener Platz ist wieder verfügbar', async () => {
        const response = await request(
          'POST',
          registerPath,
          sessionC.token,
        )

        assert.equal(response.status, 201)
      })

      // Test 14
      await t.step('Organizer darf Anmeldung nicht löschen', async () => {
        const response = await request(
          'DELETE',
          unregisterPath,
          organizerSession.token,
        )

        assert.equal(response.status, 403)
      })

      // Test 15: Event absagen
      await t.step('Abgesagtes Event sperrt neue Anmeldungen', async () => {
        const cancelled = await request(
          'POST',
          `/api/events/${eventId}/cancel`,
          organizerSession.token,
        )

        assert.equal(cancelled.status, 200)

        const response = await request(
          'POST',
          registerPath,
          sessionA.token,
        )

        assert.equal(response.status, 409)

        const data = await response.json()
        assert.equal(data.error.code, 'EVENT_NOT_OPEN')
      })

      // Test 16
      await t.step('Abmeldung nach Absage bleibt möglich', async () => {
        const response = await request(
          'DELETE',
          unregisterPath,
          sessionC.token,
        )

        assert.equal(response.status, 204)
      })

      // Test 17
      await t.step('Nach Veranstaltungsbeginn keine Abmeldung', async () => {
        // Nur Testdaten: Eventtermin in die Vergangenheit setzen
        await sql`
          UPDATE events
          SET
            starts_at = NOW() - INTERVAL '4 hours',
            ends_at = NOW() - INTERVAL '2 hours'
          WHERE id = ${eventId}::uuid
        `

        const response = await request(
          'DELETE',
          unregisterPath,
          sessionB.token,
        )

        assert.equal(response.status, 409)
      })

      // Test 18
      await t.step('Unbekanntes Event liefert 404', async () => {
        const response = await request(
          'POST',
          `/api/events/${crypto.randomUUID()}/registrations`,
          sessionA.token,
        )

        assert.equal(response.status, 404)
      })

      // Test 19: Race Condition
      await t.step('Letzter Platz wird nur einmal vergeben', async () => {
        const smallEventId = await createDraft(
          'CE24 Letzter Platz',
          1,
        )

        const published = await request(
          'POST',
          `/api/events/${smallEventId}/publish`,
          organizerSession.token,
        )

        assert.equal(published.status, 200)

        const path =
          `/api/events/${smallEventId}/registrations`

        // Zwei Studenten melden sich gleichzeitig an
        const [first, second] = await Promise.all([
          request('POST', path, sessionA.token),
          request('POST', path, sessionC.token),
        ])

        const statuses = [
          first.status,
          second.status,
        ].sort((a, b) => a - b)

        assert.deepEqual(statuses, [201, 409])

        const rows = await sql<{ total: number }[]>`
          SELECT COUNT(*)::integer AS total
          FROM registrations
          WHERE event_id = ${smallEventId}::uuid
        `

        assert.equal(rows[0].total, 1)
      })

    } finally {
      // Ausschließlich temporäre CE-24-Daten entfernen
      try {
        for (const id of eventIds) {
          await sql`
            DELETE FROM registrations
            WHERE event_id = ${id}::uuid
          `

          await sql`
            DELETE FROM events
            WHERE id = ${id}::uuid
          `
        }

        for (const token of tokens) {
          await revokeSession(token)
        }

        for (const id of userIds) {
          await sql`
            DELETE FROM users
            WHERE id = ${id}::uuid
          `
        }
      } finally {
        await sql.end()
      }
    }
  },
)