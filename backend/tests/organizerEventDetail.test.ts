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
  'CE-23: Geschützter Organizer-Eventdetail-Endpunkt',
  async (t) => {
    const userIds: string[] = []
    const eventIds: string[] = []
    const tokens: string[] = []

    // Testbenutzer mit deaktiviertem Passwort anlegen
    const createTestUser = async (
      role: TestRole,
    ): Promise<string> => {
      const email =
        `ce23-${role}-${crypto.randomUUID()}@campusevent.example`

      const rows = await sql<{ id: string }[]>`
        INSERT INTO users (
          name,
          email,
          password_hash,
          role
        )
        VALUES (
          'CE23 Integrationstest',
          ${email},
          '!CE23_LOGIN_DISABLED!',
          ${role}
        )
        RETURNING id
      `

      assert.ok(rows[0])

      userIds.push(rows[0].id)

      return rows[0].id
    }

    // Anfragen an Hono ohne separaten HTTP-Server
    const request = (
      method: 'GET' | 'POST' | 'PATCH',
      path: string,
      token?: string,
      body?: unknown,
    ) => {
      const headers: Record<string, string> = {
        Origin: ORIGIN,
      }

      if (token) {
        headers.Cookie = `campus_event_session=${token}`
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
        SELECT id FROM categories LIMIT 1
      `

      assert.ok(
        categories[0],
        'Keine Kategorie vorhanden. Demo-Seed überprüfen.',
      )

      const organizerA = await createTestUser('organizer')
      const organizerB = await createTestUser('organizer')
      const student = await createTestUser('student')

      const sessionA = await createSession(organizerA)
      const sessionB = await createSession(organizerB)
      const studentSession = await createSession(student)

      tokens.push(
        sessionA.token,
        sessionB.token,
        studentSession.token,
      )

      const startsAt = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      )

      const endsAt = new Date(
        startsAt.getTime() + 2 * 60 * 60 * 1000,
      )

      // Entwurf über die bestehende API erstellen
      const createResponse = await request(
        'POST',
        '/api/events',
        sessionA.token,
        {
          title: 'CE23 Integrationstest Entwurf',
          description:
            'Diese Veranstaltung testet das Bearbeitungsformular.',
          location: 'Campus Mosbach',
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          capacity: 50,
          categoryId: categories[0].id,
        },
      )

      assert.equal(createResponse.status, 201)

      const createdData = await createResponse.json()
      const eventId: string = createdData.event.id

      eventIds.push(eventId)

      // Test 1
      await t.step(
        'Organizer kann eigenen Entwurf abrufen',
        async () => {
          const response = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.equal(data.event.id, eventId)
          assert.equal(data.event.status, 'draft')
          assert.equal(data.event.organizer.id, organizerA)
          assert.equal(data.event.capacity, 50)
        },
      )

      // Test 2
      await t.step(
        'Gast erhält HTTP 401',
        async () => {
          const response = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
          )

          assert.equal(response.status, 401)
        },
      )

      // Test 3
      await t.step(
        'Student erhält HTTP 403',
        async () => {
          const response = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
            studentSession.token,
          )

          assert.equal(response.status, 403)
        },
      )

      // Test 4
      await t.step(
        'Fremder Organizer erhält HTTP 404',
        async () => {
          const response = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
            sessionB.token,
          )

          assert.equal(response.status, 404)
        },
      )

      // Test 5
      await t.step(
        'Ungültige UUID liefert HTTP 400',
        async () => {
          const response = await request(
            'GET',
            '/api/organizer/events/ungueltig',
            sessionA.token,
          )

          assert.equal(response.status, 400)
        },
      )

      // Test 6
      await t.step(
        'Unbekanntes Event liefert HTTP 404',
        async () => {
          const response = await request(
            'GET',
            `/api/organizer/events/${crypto.randomUUID()}`,
            sessionA.token,
          )

          assert.equal(response.status, 404)
        },
      )

      // Test 7
      await t.step(
        'Öffentliche Detail-API zeigt Entwurf nicht',
        async () => {
          const response = await request(
            'GET',
            `/api/events/${eventId}`,
          )

          assert.equal(response.status, 404)
        },
      )

      // Test 8
      await t.step(
        'PATCH speichert bearbeitete Eventdaten',
        async () => {
          const response = await request(
            'PATCH',
            `/api/events/${eventId}`,
            sessionA.token,
            {
              title: 'CE23 Aktualisierter Entwurf',
              capacity: 120,
            },
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.equal(
            data.event.title,
            'CE23 Aktualisierter Entwurf',
          )

          assert.equal(data.event.capacity, 120)
        },
      )

      // Test 9
      await t.step(
        'GET liefert die gespeicherten Änderungen',
        async () => {
          const response = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.equal(
            data.event.title,
            'CE23 Aktualisierter Entwurf',
          )

          assert.equal(data.event.capacity, 120)
          assert.equal(data.event.location, 'Campus Mosbach')
        },
      )

      // Test 10
      await t.step(
        'GET funktioniert auch ohne Origin-Header',
        async () => {
          const response = await app.request(
            `/api/organizer/events/${eventId}`,
            {
              headers: {
                Cookie:
                  `campus_event_session=${sessionA.token}`,
              },
            },
          )

          assert.equal(response.status, 200)
        },
      )

      // Test 11
      await t.step(
        'Nach Veröffentlichung bleibt eigenes Event lesbar',
        async () => {
          const publishResponse = await request(
            'POST',
            `/api/events/${eventId}/publish`,
            sessionA.token,
          )

          assert.equal(publishResponse.status, 200)

          const detailResponse = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
            sessionA.token,
          )

          assert.equal(detailResponse.status, 200)

          const data = await detailResponse.json()
          assert.equal(data.event.status, 'published')
        },
      )

      // Test 12
      await t.step(
        'Nach Absage bleibt eigenes Event lesbar',
        async () => {
          const cancelResponse = await request(
            'POST',
            `/api/events/${eventId}/cancel`,
            sessionA.token,
          )

          assert.equal(cancelResponse.status, 200)

          const detailResponse = await request(
            'GET',
            `/api/organizer/events/${eventId}`,
            sessionA.token,
          )

          assert.equal(detailResponse.status, 200)

          const data = await detailResponse.json()
          assert.equal(data.event.status, 'cancelled')
        },
      )

    } finally {
      // Ausschließlich eigene temporäre Testdaten entfernen
      try {
        for (const id of eventIds) {
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