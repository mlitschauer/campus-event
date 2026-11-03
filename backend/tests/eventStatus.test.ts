import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  createSession,
  revokeSession,
} from '../src/services/sessionService.ts'

const ORIGIN = 'http://localhost:5173'

type TestRole = 'student' | 'organizer'

Deno.test('CE-21: Eventstatus und Veröffentlichung', async (t) => {
  const userIds: string[] = []
  const eventIds: string[] = []
  const tokens: string[] = []

  // Test-HTTP-Anfragen an die bestehende Hono-App
  function request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    token?: string,
    body?: unknown,
  ) {
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

  // Temporären Testbenutzer anlegen
  async function createTestUser(
    role: TestRole,
  ): Promise<string> {
    const email =
      `ce21-${role}-${crypto.randomUUID()}@campusevent.example`

    const rows = await sql<{ id: string }[]>`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role
      )
      VALUES (
        'CE21 Testbenutzer',
        ${email},
        '!CE21_TEST_LOGIN_DISABLED!',
        ${role}
      )
      RETURNING id
    `

    assert.ok(rows[0])

    userIds.push(rows[0].id)
    return rows[0].id
  }

  try {
    // Vorhandene Kategorie aus unserer Demo-Datenbank
    const categories = await sql<{ id: string }[]>`
      SELECT id
      FROM categories
      LIMIT 1
    `

    assert.ok(
      categories[0],
      'Keine Kategorie vorhanden. Bitte Demo-Seed prüfen.',
    )

    const categoryId = categories[0].id

    // Temporäre Benutzer
    const organizerA = await createTestUser('organizer')
    const organizerB = await createTestUser('organizer')
    const student = await createTestUser('student')

    // Gültige Sessions für die API-Tests
    const sessionA = await createSession(organizerA)
    const sessionB = await createSession(organizerB)
    const studentSession = await createSession(student)

    tokens.push(
      sessionA.token,
      sessionB.token,
      studentSession.token,
    )

    // Testtermine 10 Tage in der Zukunft
    const start = new Date(
      Date.now() + 10 * 24 * 60 * 60 * 1000,
    )

    const end = new Date(
      start.getTime() + 2 * 60 * 60 * 1000,
    )

    const eventData = {
      title: 'CE21 Campus Testevent',
      description:
        'Diese Veranstaltung wird automatisch getestet.',
      location: 'Campus Mosbach',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      capacity: 80,
      categoryId,
    }

    let eventId = ''
    let pastEventId = ''

    // TEST 1
    await t.step('Öffentliche Eventliste bleibt erreichbar', async () => {
      const response = await request(
        'GET',
        '/api/events',
      )

      assert.equal(response.status, 200)
    })

    // TEST 2
    await t.step('Organizer erstellt einen Entwurf', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        eventData,
      )

      assert.equal(response.status, 201)

      const data = await response.json()

      assert.equal(data.event.status, 'draft')
      assert.equal(data.event.organizer.id, organizerA)

      eventId = data.event.id
      eventIds.push(eventId)
    })

    // TEST 3
    await t.step('Entwurf ist nicht öffentlich', async () => {
      const response = await request(
        'GET',
        `/api/events/${eventId}`,
      )

      assert.equal(response.status, 404)
    })

    // TEST 4
    await t.step('Gast darf nicht veröffentlichen', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/publish`,
      )

      assert.equal(response.status, 401)
    })

    // TEST 5
    await t.step('Student darf nicht veröffentlichen', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/publish`,
        studentSession.token,
      )

      assert.equal(response.status, 403)
    })

    // TEST 6
    await t.step('Fremde Origin wird abgelehnt', async () => {
      const response = await app.request(
        `/api/events/${eventId}/publish`,
        {
          method: 'POST',
          headers: {
            Origin: 'https://untrusted.example',
            Cookie: `campus_event_session=${sessionA.token}`,
          },
        },
      )

      assert.equal(response.status, 403)
    })

    // TEST 7
    await t.step('Ungültige Event-ID wird abgelehnt', async () => {
      const response = await request(
        'POST',
        '/api/events/abc/publish',
        sessionA.token,
      )

      assert.equal(response.status, 400)
    })

    // TEST 8
    await t.step('Fremder Organizer darf nicht veröffentlichen', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/publish`,
        sessionB.token,
      )

      assert.equal(response.status, 404)
    })

    // TEST 9
    await t.step('Ein Entwurf kann nicht abgesagt werden', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/cancel`,
        sessionA.token,
      )

      assert.equal(response.status, 409)
    })

    // TEST 10
    await t.step('Paralleles Veröffentlichen erfolgt nur einmal', async () => {
      const [first, second] = await Promise.all([
        request(
          'POST',
          `/api/events/${eventId}/publish`,
          sessionA.token,
        ),
        request(
          'POST',
          `/api/events/${eventId}/publish`,
          sessionA.token,
        ),
      ])

      const statuses = [
        first.status,
        second.status,
      ].sort((a, b) => a - b)

      // Genau eine Anfrage wird erfolgreich verarbeitet.
      assert.deepEqual(statuses, [200, 409])

      const rows = await sql<{ status: string }[]>`
        SELECT status
        FROM events
        WHERE id = ${eventId}::uuid
      `

      assert.equal(rows[0].status, 'published')
    })

    // TEST 11
    await t.step('Veröffentlichtes Event ist öffentlich', async () => {
      const response = await request(
        'GET',
        `/api/events/${eventId}`,
      )

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.id, eventId)
      assert.equal(data.status, 'published')
    })

    // TEST 12
    await t.step('Erneute Veröffentlichung wird abgelehnt', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/publish`,
        sessionA.token,
      )

      assert.equal(response.status, 409)

      const data = await response.json()

      assert.equal(
        data.error.code,
        'INVALID_EVENT_STATUS',
      )
    })

    // TEST 13
    await t.step('Veröffentlichtes Event bleibt vor PATCH geschützt', async () => {
      const response = await request(
        'PATCH',
        `/api/events/${eventId}`,
        sessionA.token,
        { title: 'Unzulässige Änderung' },
      )

      assert.equal(response.status, 409)
    })

    // TEST 14
    await t.step('Veröffentlichtes Event bleibt vor DELETE geschützt', async () => {
      const response = await request(
        'DELETE',
        `/api/events/${eventId}`,
        sessionA.token,
      )

      assert.equal(response.status, 409)
    })

    // TEST 15
    await t.step('Fremder Organizer darf nicht absagen', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/cancel`,
        sessionB.token,
      )

      assert.equal(response.status, 404)
    })

    // TEST 16
    await t.step('Student darf nicht absagen', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/cancel`,
        studentSession.token,
      )

      assert.equal(response.status, 403)
    })

    // TEST 17
    await t.step('Eigener Organizer kann Event absagen', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/cancel`,
        sessionA.token,
      )

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.event.id, eventId)
      assert.equal(data.event.status, 'cancelled')

      const rows = await sql<{ status: string }[]>`
        SELECT status
        FROM events
        WHERE id = ${eventId}::uuid
      `

      assert.equal(rows[0].status, 'cancelled')
    })

    // TEST 18
    await t.step('Abgesagtes Event ist nicht mehr öffentlich', async () => {
      const response = await request(
        'GET',
        `/api/events/${eventId}`,
      )

      assert.equal(response.status, 404)
    })

    // TEST 19
    await t.step('Erneute Absage wird abgelehnt', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/cancel`,
        sessionA.token,
      )

      assert.equal(response.status, 409)
    })

    // TEST 20
    await t.step('Abgesagtes Event kann nicht erneut veröffentlicht werden', async () => {
      const response = await request(
        'POST',
        `/api/events/${eventId}/publish`,
        sessionA.token,
      )

      assert.equal(response.status, 409)
    })

    // TEST 21
    await t.step('Zweiten Entwurf für Zeitprüfung erstellen', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        {
          ...eventData,
          title: 'CE21 Vergangenes Testevent',
        },
      )

      assert.equal(response.status, 201)

      const data = await response.json()

      pastEventId = data.event.id
      eventIds.push(pastEventId)

      // Nur im TEST: Zeitpunkt in die Vergangenheit legen
      await sql`
        UPDATE events
        SET
          starts_at = NOW() - INTERVAL '4 hours',
          ends_at = NOW() - INTERVAL '2 hours'
        WHERE id = ${pastEventId}::uuid
      `
    })

    // TEST 22
    await t.step('Vergangenes Event darf nicht veröffentlicht werden', async () => {
      const response = await request(
        'POST',
        `/api/events/${pastEventId}/publish`,
        sessionA.token,
      )

      assert.equal(response.status, 409)

      const data = await response.json()

      assert.equal(
        data.error.code,
        'EVENT_START_PASSED',
      )
    })

    // TEST 23
    await t.step('Unbekanntes Event liefert 404', async () => {
      const response = await request(
        'POST',
        `/api/events/${crypto.randomUUID()}/publish`,
        sessionA.token,
      )

      assert.equal(response.status, 404)
    })

    // TEST 24
    await t.step('Fehlende Origin wird abgelehnt', async () => {
      const response = await app.request(
        `/api/events/${pastEventId}/publish`,
        {
          method: 'POST',
          headers: {
            Cookie: `campus_event_session=${sessionA.token}`,
          },
        },
      )

      assert.equal(response.status, 403)
    })

  } finally {
    // Aufräumen – auch bei fehlgeschlagenen Tests.
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
})