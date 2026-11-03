import assert from 'node:assert/strict'
import { Hono } from 'hono'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  requireAuth,
} from '../src/middleware/authMiddleware.ts'

import {
  requireRole,
} from '../src/middleware/roleMiddleware.ts'

import {
  createSession,
  revokeSession,
} from '../src/services/sessionService.ts'

import {
  hashSessionToken,
} from '../src/security/sessionToken.ts'

import type {
  UserRole,
} from '../src/repositories/sessionRepository.ts'

// Testanwendung – wird NICHT in app.ts eingebunden
const testApp = new Hono()

// Jeder angemeldete Benutzer darf zugreifen
testApp.get(
  '/test/profile',
  requireAuth,
  (c) => {
    return c.json({
      user: c.get('authUser'),
      sessionId: c.get('authSessionId'),
    })
  },
)

// Student und Organizer dürfen zugreifen
testApp.get(
  '/test/member',
  requireAuth,
  requireRole('student', 'organizer'),
  (c) => {
    return c.json({
      message: 'Zugriff erlaubt.',
      role: c.get('authUser').role,
    })
  },
)

// Nur Organizer darf zugreifen
testApp.get(
  '/test/organizer',
  requireAuth,
  requireRole('organizer'),
  (c) => {
    return c.json({
      message: 'Organizer-Zugriff erlaubt.',
      userId: c.get('authUser').id,
    })
  },
)

// Absichtlich fehlerhaft eingebundene Rollenmiddleware:
// Muss trotzdem sicher verweigern.
testApp.get(
  '/test/role-without-auth',
  requireRole('organizer'),
  (c) => c.json({ message: 'Nicht erreichbar.' }),
)

// Cookie für Testanfragen vorbereiten
function cookieHeader(token: string): string {
  return `campus_event_session=${token}`
}

Deno.test('CE-18: Authentifizierung und Berechtigungen', async (t) => {
  const tokensToCleanup: string[] = []

  try {
    // Vorhandene Demo-Benutzer aus PostgreSQL laden
    const users = await sql<{
      id: string
      role: UserRole
    }[]>`
      SELECT id, role
      FROM users
      WHERE role IN ('student', 'organizer')
    `

    const student = users.find(
      (user) => user.role === 'student',
    )

    const organizer = users.find(
      (user) => user.role === 'organizer',
    )

    assert.ok(student, 'Kein Teststudent vorhanden.')
    assert.ok(organizer, 'Kein Organizer vorhanden.')

    // Sessions direkt für die Integrationstests erstellen.
    // Dies umgeht nur im Test die Login-Endpunkte.
    const studentSession = await createSession(student.id)
    const organizerSession = await createSession(organizer.id)

    tokensToCleanup.push(
      studentSession.token,
      organizerSession.token,
    )

    // TEST 1
    await t.step('Öffentliche Events bleiben zugänglich', async () => {
      const response = await app.request('/api/events')

      assert.equal(response.status, 200)
    })

    // TEST 2
    await t.step('Gast darf /api/auth/me nicht abrufen', async () => {
      const response = await app.request('/api/auth/me')

      assert.equal(response.status, 401)

      const data = await response.json()

      assert.equal(data.error.code, 'UNAUTHORIZED')
    })

    // TEST 3
    await t.step('Geschützte Route ohne Cookie liefert 401', async () => {
      const response = await testApp.request('/test/profile')

      assert.equal(response.status, 401)
    })

    // TEST 4
    await t.step('Ungültiger Session-Token liefert 401', async () => {
      const response = await testApp.request('/test/profile', {
        headers: {
          Cookie: cookieHeader('invalid-token'),
        },
      })

      assert.equal(response.status, 401)
    })

    // TEST 5
    await t.step('Unbekannter Token liefert 401', async () => {
      const response = await testApp.request('/test/profile', {
        headers: {
          Cookie: cookieHeader('a'.repeat(64)),
        },
      })

      assert.equal(response.status, 401)
    })

    // TEST 6
    await t.step('Student hat Zugriff auf Mitgliederbereich', async () => {
      const response = await testApp.request('/test/member', {
        headers: {
          Cookie: cookieHeader(studentSession.token),
        },
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.role, 'student')
    })

    // TEST 7
    await t.step('Student darf Organizer-Route nicht nutzen', async () => {
      const response = await testApp.request('/test/organizer', {
        headers: {
          Cookie: cookieHeader(studentSession.token),
        },
      })

      assert.equal(response.status, 403)

      const data = await response.json()

      assert.equal(data.error.code, 'FORBIDDEN')
    })

    // TEST 8
    await t.step('Organizer hat Zugriff auf Mitgliederbereich', async () => {
      const response = await testApp.request('/test/member', {
        headers: {
          Cookie: cookieHeader(organizerSession.token),
        },
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.role, 'organizer')
    })

    // TEST 9
    await t.step('Organizer hat Zugriff auf Organizer-Route', async () => {
      const response = await testApp.request('/test/organizer', {
        headers: {
          Cookie: cookieHeader(organizerSession.token),
        },
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.userId, organizer.id)
    })

    // TEST 10
    await t.step('Authentifizierter Benutzer ist im Kontext', async () => {
      const response = await testApp.request('/test/profile', {
        headers: {
          Cookie: cookieHeader(studentSession.token),
        },
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.user.id, student.id)
      assert.equal(data.user.role, 'student')
      assert.ok(data.sessionId)

      // Niemals Passwort-Hash herausgeben
      assert.equal(data.user.password_hash, undefined)
    })

    // TEST 11
    await t.step('GET /api/auth/me nutzt die Middleware', async () => {
      const response = await app.request('/api/auth/me', {
        headers: {
          Cookie: cookieHeader(studentSession.token),
        },
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.user.id, student.id)
      assert.equal(
        response.headers.get('cache-control'),
        'no-store',
      )
    })

    // TEST 12
    await t.step('Rollenmiddleware ohne Auth verweigert Zugriff', async () => {
      const response = await testApp.request(
        '/test/role-without-auth',
      )

      assert.equal(response.status, 401)
    })

    // TEST 13
    await t.step('Widerrufene Session ist sofort ungültig', async () => {
      const revoked = await revokeSession(studentSession.token)

      assert.equal(revoked, true)

      const response = await testApp.request('/test/member', {
        headers: {
          Cookie: cookieHeader(studentSession.token),
        },
      })

      assert.equal(response.status, 401)
    })

    // TEST 14
    await t.step('Abgelaufene Session wird abgelehnt', async () => {
      const expiredSession = await createSession(organizer.id)

      tokensToCleanup.push(expiredSession.token)

      const tokenHash = await hashSessionToken(
        expiredSession.token,
      )

      await sql`
        UPDATE sessions
        SET expires_at = NOW() - INTERVAL '1 second'
        WHERE token_hash = ${tokenHash}
      `

      const response = await testApp.request('/test/organizer', {
        headers: {
          Cookie: cookieHeader(expiredSession.token),
        },
      })

      assert.equal(response.status, 401)
    })

  } finally {
    // Alle vom Test erzeugten Sessions entfernen
    try {
      for (const token of tokensToCleanup) {
        await revokeSession(token)
      }
    } finally {
      await sql.end()
    }
  }
})