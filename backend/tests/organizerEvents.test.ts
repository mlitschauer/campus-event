import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  createSession,
  revokeSession,
} from '../src/services/sessionService.ts'

type TestRole = 'student' | 'organizer'

const ORIGIN = 'http://localhost:5173'

Deno.test('CE-22: Geschützte Organizer-Eventliste', async (t) => {
  const userIds: string[] = []
  const eventIds: string[] = []
  const tokens: string[] = []

  // Temporäre Testbenutzer anlegen
  async function createTestUser(
    role: TestRole,
  ): Promise<string> {
    const email =
      `ce22-${role}-${crypto.randomUUID()}@campusevent.example`

    const rows = await sql<{ id: string }[]>`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role
      )
      VALUES (
        'CE22 Testbenutzer',
        ${email},
        '!CE22_LOGIN_DISABLED!',
        ${role}
      )
      RETURNING id
    `

    assert.ok(rows[0])

    userIds.push(rows[0].id)

    return rows[0].id
  }

  // HTTP-Anfragen an die Hono-Anwendung
  function request(
    method: 'GET' | 'POST',
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

  try {
    // Testdatenbank muss bereits Kategorien enthalten
    const categories = await sql<{ id: string }[]>`
      SELECT id
      FROM categories
      LIMIT 1
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

    const start = new Date(Date.now() + 7 * 86400000)
    const end = new Date(start.getTime() + 7200000)

    const eventData = {
      description:
        'Diese Veranstaltung wird automatisch getestet.',
      location: 'Campus Mosbach',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      capacity: 80,
      categoryId: categories[0].id,
    }

    // Hilfsfunktion: Entwurf über die echte REST-API erstellen
    // Hilfsfunktion: Entwurf über die echte REST-API erstellen
const createDraft = async (
  token: string,
  title: string,
): Promise<string> => {
  const response = await request(
    'POST',
    '/api/events',
    token,
    {
      ...eventData,
      title,
    },
  )

  assert.equal(response.status, 201)

  const data = await response.json()
  const id: string = data.event.id

  assert.equal(data.event.status, 'draft')

  eventIds.push(id)
  return id
}

    // TEST 1
    await t.step('Gast erhält HTTP 401', async () => {
      const response = await request(
        'GET',
        '/api/organizer/events',
      )

      assert.equal(response.status, 401)
    })

    // TEST 2
    await t.step('Student erhält HTTP 403', async () => {
      const response = await request(
        'GET',
        '/api/organizer/events',
        studentSession.token,
      )

      assert.equal(response.status, 403)
    })

    // TEST 3
    await t.step('Neuer Organizer erhält leere Liste', async () => {
      const response = await request(
        'GET',
        '/api/organizer/events',
        sessionA.token,
      )

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.deepEqual(data.events, [])
      assert.equal(
        response.headers.get('cache-control'),
        'no-store',
      )
    })

    // Testevents erstellen
    const draftId = await createDraft(
      sessionA.token,
      'CE22 Entwurf',
    )

    const publishedId = await createDraft(
      sessionA.token,
      'CE22 Veröffentlichtes Event',
    )

    const cancelledId = await createDraft(
      sessionA.token,
      'CE22 Abgesagtes Event',
    )

    const foreignId = await createDraft(
      sessionB.token,
      'CE22 Fremdes Event',
    )

    // Event veröffentlichen
    const publishResponse = await request(
      'POST',
      `/api/events/${publishedId}/publish`,
      sessionA.token,
    )

    assert.equal(publishResponse.status, 200)

    // Anderes Event veröffentlichen und absagen
    const publishCancelled = await request(
      'POST',
      `/api/events/${cancelledId}/publish`,
      sessionA.token,
    )

    assert.equal(publishCancelled.status, 200)

    const cancelResponse = await request(
      'POST',
      `/api/events/${cancelledId}/cancel`,
      sessionA.token,
    )

    assert.equal(cancelResponse.status, 200)

    // TEST 4
    await t.step('Organizer A erhält alle eigenen Status', async () => {
      const response = await request(
        'GET',
        '/api/organizer/events',
        sessionA.token,
      )

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.events.length, 3)

      const statuses = data.events
        .map((event: { status: string }) => event.status)
        .sort()

      assert.deepEqual(statuses, [
        'cancelled',
        'draft',
        'published',
      ])
    })

    // TEST 5
    await t.step('Organizer A sieht keine fremden Events', async () => {
      const response = await request(
        'GET',
        '/api/organizer/events',
        sessionA.token,
      )

      const data = await response.json()

      const ids: string[] = data.events.map(
        (event: { id: string }) => event.id,
      )

      assert.ok(ids.includes(draftId))
      assert.ok(ids.includes(publishedId))
      assert.ok(ids.includes(cancelledId))

      assert.ok(!ids.includes(foreignId))

      for (const event of data.events) {
        assert.equal(event.organizer.id, organizerA)
        assert.equal(event.password_hash, undefined)
        assert.equal(typeof event.startsAt, 'string')
      }
    })

    // TEST 6
    await t.step('Organizer B sieht ausschließlich eigene Events', async () => {
      const response = await request(
        'GET',
        '/api/organizer/events',
        sessionB.token,
      )

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.events.length, 1)
      assert.equal(data.events[0].id, foreignId)
      assert.equal(data.events[0].organizer.id, organizerB)
    })

    // TEST 7
    await t.step('Entwürfe bleiben öffentlich unsichtbar', async () => {
      const response = await request(
        'GET',
        `/api/events/${draftId}`,
      )

      assert.equal(response.status, 404)
    })

    // TEST 8
    await t.step('Abgesagte Events bleiben öffentlich unsichtbar', async () => {
      const response = await request(
        'GET',
        `/api/events/${cancelledId}`,
      )

      assert.equal(response.status, 404)
    })

    // TEST 9
    await t.step('Veröffentlichtes Event bleibt öffentlich', async () => {
      const response = await request(
        'GET',
        `/api/events/${publishedId}`,
      )

      assert.equal(response.status, 200)
    })

    // TEST 10
    await t.step('GET funktioniert ohne Origin-Header', async () => {
      const response = await app.request(
        '/api/organizer/events',
        {
          headers: {
            Cookie:
              `campus_event_session=${sessionA.token}`,
          },
        },
      )

      assert.equal(response.status, 200)
    })

    // TEST 11
    await t.step('Rollenänderung wirkt auf aktive Sessions', async () => {
      await sql`
        UPDATE users
        SET role = 'student'
        WHERE id = ${organizerA}::uuid
      `

      const response = await request(
        'GET',
        '/api/organizer/events',
        sessionA.token,
      )

      assert.equal(response.status, 403)
    })

    // TEST 12
    await t.step('Widerrufene Session wird abgelehnt', async () => {
      await revokeSession(sessionB.token)

      const response = await request(
        'GET',
        '/api/organizer/events',
        sessionB.token,
      )

      assert.equal(response.status, 401)
    })

  } finally {
    // Testveranstaltungen und -benutzer aufräumen
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