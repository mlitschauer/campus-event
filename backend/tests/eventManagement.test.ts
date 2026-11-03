import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  createSession,
  revokeSession,
} from '../src/services/sessionService.ts'

const ORIGIN = 'http://localhost:5173'

type TestRole = 'student' | 'organizer'

Deno.test('CE-20: Eventverwaltung für Organizer', async (t) => {
  const userIds: string[] = []
  const eventIds: string[] = []
  const tokens: string[] = []

  // HTTP-Anfrage mit optionalem Session-Cookie
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
      `ce20-${role}-${crypto.randomUUID()}@campusevent.example`

    const rows = await sql<{ id: string }[]>`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role
      )
      VALUES (
        'CE20 Testbenutzer',
        ${email},
        '!CE20_TEST_LOGIN_DISABLED!',
        ${role}
      )
      RETURNING id
    `

    const user = rows[0]
    assert.ok(user)

    userIds.push(user.id)
    return user.id
  }

  try {
    // Vorhandene Kategorie verwenden
    const categoryRows = await sql<{ id: string }[]>`
      SELECT id
      FROM categories
      ORDER BY name
      LIMIT 1
    `

    const category = categoryRows[0]

    assert.ok(
      category,
      'Keine Kategorie vorhanden. Bitte Demo-Seed prüfen.',
    )

    // Drei Testbenutzer anlegen
    const organizerA = await createTestUser('organizer')
    const organizerB = await createTestUser('organizer')
    const student = await createTestUser('student')

    // Test-Sessions erzeugen
    const sessionA = await createSession(organizerA)
    const sessionB = await createSession(organizerB)
    const studentSession = await createSession(student)

    tokens.push(
      sessionA.token,
      sessionB.token,
      studentSession.token,
    )

    // Zukünftige Testtermine
    const start = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    )

    const end = new Date(
      start.getTime() + 2 * 60 * 60 * 1000,
    )

    const eventData = {
      title: 'CE20 Testveranstaltung',
      description:
        'Dies ist eine automatisch erzeugte Testveranstaltung.',
      location: 'Campus Mosbach',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      capacity: 80,
      categoryId: category.id,
    }

    let ownEventId = ''

    // TEST 1
    await t.step('Öffentliche Events bleiben erreichbar', async () => {
      const response = await request('GET', '/api/events')

      assert.equal(response.status, 200)
    })

    // TEST 2
    await t.step('Gast darf kein Event erstellen', async () => {
      const response = await request(
        'POST',
        '/api/events',
        undefined,
        eventData,
      )

      assert.equal(response.status, 401)
    })

    // TEST 3
    await t.step('Student darf kein Event erstellen', async () => {
      const response = await request(
        'POST',
        '/api/events',
        studentSession.token,
        eventData,
      )

      assert.equal(response.status, 403)
    })

    // TEST 4
    await t.step('Fremde Origin wird abgelehnt', async () => {
      const response = await app.request('/api/events', {
        method: 'POST',
        headers: {
          Origin: 'https://untrusted.example',
          Cookie: `campus_event_session=${sessionA.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      assert.equal(response.status, 403)
    })

    // TEST 5
    await t.step('Organizer-ID und Status sind nicht manipulierbar', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        {
          ...eventData,
          organizerId: organizerB,
          status: 'published',
        },
      )

      assert.equal(response.status, 400)
    })

    // TEST 6
    await t.step('Ungültiger Zeitraum wird abgelehnt', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        {
          ...eventData,
          endsAt: new Date(
            start.getTime() - 60_000,
          ).toISOString(),
        },
      )

      assert.equal(response.status, 400)
    })

    // TEST 7
    await t.step('Unbekannte Kategorie wird abgelehnt', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        {
          ...eventData,
          categoryId: crypto.randomUUID(),
        },
      )

      assert.equal(response.status, 400)
    })

    // TEST 8
    await t.step('Organizer erstellt einen Entwurf', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        eventData,
      )

      assert.equal(response.status, 201)

      const data = await response.json()

      assert.equal(data.event.title, eventData.title)
      assert.equal(data.event.status, 'draft')
      assert.equal(data.event.organizer.id, organizerA)
      assert.equal(data.event.category.id, category.id)

      ownEventId = data.event.id
      eventIds.push(ownEventId)

      // Tatsächlich in PostgreSQL gespeichert?
      const rows = await sql<{
        organizer_id: string
        status: string
      }[]>`
        SELECT organizer_id, status
        FROM events
        WHERE id = ${ownEventId}::uuid
      `

      assert.equal(rows.length, 1)
      assert.equal(rows[0].organizer_id, organizerA)
      assert.equal(rows[0].status, 'draft')
    })

    // TEST 9
    await t.step('Entwurf erscheint nicht öffentlich', async () => {
      const response = await request(
        'GET',
        `/api/events/${ownEventId}`,
      )

      assert.equal(response.status, 404)
    })

    // TEST 10
    await t.step('Fremder Organizer darf Event nicht bearbeiten', async () => {
      const response = await request(
        'PATCH',
        `/api/events/${ownEventId}`,
        sessionB.token,
        {
          title: 'Fremde Änderung',
        },
      )

      assert.equal(response.status, 404)
    })

    // TEST 11
    await t.step('Fremder Organizer darf Event nicht löschen', async () => {
      const response = await request(
        'DELETE',
        `/api/events/${ownEventId}`,
        sessionB.token,
      )

      assert.equal(response.status, 404)
    })

    // TEST 12
    await t.step('Ungültige Event-ID wird abgelehnt', async () => {
      const response = await request(
        'PATCH',
        '/api/events/abc',
        sessionA.token,
        {
          title: 'Neuer Titel',
        },
      )

      assert.equal(response.status, 400)
    })

    // TEST 13
    await t.step('Leerer PATCH wird abgelehnt', async () => {
      const response = await request(
        'PATCH',
        `/api/events/${ownEventId}`,
        sessionA.token,
        {},
      )

      assert.equal(response.status, 400)
    })

    // TEST 14
    await t.step('Ungültige Datumsänderung wird abgelehnt', async () => {
      const response = await request(
        'PATCH',
        `/api/events/${ownEventId}`,
        sessionA.token,
        {
          endsAt: new Date(
            start.getTime() - 60_000,
          ).toISOString(),
        },
      )

      assert.equal(response.status, 400)
    })

    // TEST 15
    await t.step('Eigener Entwurf kann bearbeitet werden', async () => {
      const response = await request(
        'PATCH',
        `/api/events/${ownEventId}`,
        sessionA.token,
        {
          title: 'CE20 Aktualisierte Veranstaltung',
          capacity: 120,
        },
      )

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(
        data.event.title,
        'CE20 Aktualisierte Veranstaltung',
      )
      assert.equal(data.event.capacity, 120)
      assert.equal(data.event.status, 'draft')
      assert.equal(data.event.organizer.id, organizerA)

      // Nicht übertragene Eigenschaften bleiben erhalten
      assert.equal(data.event.location, eventData.location)
    })

    // TEST 16: Zweiten Entwurf erstellen
    let publishedEventId = ''

    await t.step('Zweiten Testentwurf erstellen', async () => {
      const response = await request(
        'POST',
        '/api/events',
        sessionA.token,
        {
          ...eventData,
          title: 'CE20 Veröffentlichtes Testevent',
        },
      )

      assert.equal(response.status, 201)

      const data = await response.json()

      publishedEventId = data.event.id
      eventIds.push(publishedEventId)

      // Statusänderung nur direkt im TEST,
      // da CE-21 erst die Publish-API ergänzt.
      await sql`
        UPDATE events
        SET status = 'published'
        WHERE id = ${publishedEventId}::uuid
      `
    })

    // TEST 17
    await t.step('Veröffentlichtes Event nicht bearbeitbar', async () => {
      const response = await request(
        'PATCH',
        `/api/events/${publishedEventId}`,
        sessionA.token,
        {
          title: 'Unzulässige Änderung',
        },
      )

      assert.equal(response.status, 409)
    })

    // TEST 18
    await t.step('Veröffentlichtes Event nicht löschbar', async () => {
      const response = await request(
        'DELETE',
        `/api/events/${publishedEventId}`,
        sessionA.token,
      )

      assert.equal(response.status, 409)
    })

    // TEST 19
    await t.step('Eigener Entwurf kann gelöscht werden', async () => {
      const response = await request(
        'DELETE',
        `/api/events/${ownEventId}`,
        sessionA.token,
      )

      assert.equal(response.status, 204)
      assert.equal(await response.text(), '')

      const rows = await sql<{ id: string }[]>`
        SELECT id
        FROM events
        WHERE id = ${ownEventId}::uuid
      `

      assert.equal(rows.length, 0)
    })

    // TEST 20
    await t.step('Bereits gelöschtes Event liefert 404', async () => {
      const response = await request(
        'DELETE',
        `/api/events/${ownEventId}`,
        sessionA.token,
      )

      assert.equal(response.status, 404)
    })

  } finally {
    // Testdaten entfernen – auch bei einem Fehler.
    try {
      for (const eventId of eventIds) {
        await sql`
          DELETE FROM events
          WHERE id = ${eventId}::uuid
        `
      }

      for (const token of tokens) {
        await revokeSession(token)
      }

      for (const userId of userIds) {
        await sql`
          DELETE FROM users
          WHERE id = ${userId}::uuid
        `
      }
    } finally {
      await sql.end()
    }
  }
})