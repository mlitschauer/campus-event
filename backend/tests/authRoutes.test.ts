import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  getLoginRetryAfter,
  recordFailedLogin,
  clearFailedLogins,
} from '../src/security/loginRateLimit.ts'

const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'CampusEvent-TestPassphrase-2026!'

// Eindeutige E-Mail pro Testlauf
const EMAIL =
  `ce17-${crypto.randomUUID()}@campusevent.example`

// Einheitliche POST-Testanfragen
function postJson(path: string, data: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
    body: JSON.stringify(data),
  })
}

Deno.test('CE-17: Authentifizierungs-REST-API', async (t) => {
  let createdUserId: string | null = null
  let sessionCookie = ''

  try {

    await t.step('Registrierung validiert Eingaben', async () => {
      const response = await postJson('/api/auth/register', {
        name: 'A',
        email: 'ungültig',
        password: 'kurz',
      })

      assert.equal(response.status, 400)

      const data = await response.json()
      assert.equal(data.error.code, 'VALIDATION_ERROR')
    })

    await t.step('Rolle darf nicht frei gewählt werden', async () => {
      const response = await postJson('/api/auth/register', {
        name: 'Test Person',
        email: EMAIL,
        password: PASSWORD,
        role: 'organizer',
      })

      assert.equal(response.status, 400)
    })

    await t.step('Neuen Studenten registrieren', async () => {
      const response = await postJson('/api/auth/register', {
        name: 'CE17 Testperson',
        email: EMAIL.toUpperCase(),
        password: PASSWORD,
      })

      assert.equal(response.status, 201)

      const data = await response.json()

      createdUserId = data.user.id

      assert.equal(data.user.email, EMAIL)
      assert.equal(data.user.role, 'student')
      assert.equal(data.user.name, 'CE17 Testperson')

      // Niemals Passwort oder Hash ausgeben
      assert.equal(data.user.password, undefined)
      assert.equal(data.user.password_hash, undefined)

      // Tatsächlich gespeicherten Passwort-Hash prüfen
      const rows = await sql<{ password_hash: string }[]>`
        SELECT password_hash
        FROM users
        WHERE id = ${createdUserId}::uuid
      `

      assert.equal(rows.length, 1)
      assert.ok(rows[0].password_hash.startsWith('$argon2id$'))
      assert.notEqual(rows[0].password_hash, PASSWORD)
    })

    await t.step('Doppelte Registrierung liefert 409', async () => {
      const response = await postJson('/api/auth/register', {
        name: 'Noch eine Person',
        email: EMAIL,
        password: PASSWORD,
      })

      assert.equal(response.status, 409)

      const data = await response.json()
      assert.equal(data.error.code, 'EMAIL_ALREADY_EXISTS')
    })

    await t.step('Anfrage von fremder Origin wird abgelehnt', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://untrusted.example',
        },
        body: JSON.stringify({
          email: EMAIL,
          password: PASSWORD,
        }),
      })

      assert.equal(response.status, 403)
    })

    await t.step('Falsches Passwort liefert 401', async () => {
      const response = await postJson('/api/auth/login', {
        email: EMAIL,
        password: 'falsches-passwort',
      })

      assert.equal(response.status, 401)

      const data = await response.json()
      assert.equal(data.error.code, 'INVALID_CREDENTIALS')
    })

    await t.step('Unbekannte E-Mail liefert denselben Fehler', async () => {
      const response = await postJson('/api/auth/login', {
        email: 'unbekannt@campusevent.example',
        password: PASSWORD,
      })

      assert.equal(response.status, 401)

      const data = await response.json()
      assert.equal(data.error.code, 'INVALID_CREDENTIALS')
    })

    await t.step('Ohne Session ist /me geschützt', async () => {
      const response = await app.request('/api/auth/me')

      assert.equal(response.status, 401)

      const data = await response.json()
      assert.equal(data.error.code, 'UNAUTHORIZED')
    })

    await t.step('Login erstellt sicheres Session-Cookie', async () => {
      const response = await postJson('/api/auth/login', {
        email: EMAIL,
        password: PASSWORD,
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.user.email, EMAIL)
      assert.equal(data.user.role, 'student')
      assert.equal(data.token, undefined)
      assert.equal(data.user.password_hash, undefined)

      const setCookieHeader = response.headers.get('set-cookie')

      assert.ok(setCookieHeader)
      assert.match(setCookieHeader, /HttpOnly/i)
      assert.match(setCookieHeader, /SameSite=Lax/i)
      assert.match(setCookieHeader, /Path=\/api/i)

      // Cookie intern für weitere Tests übernehmen
      sessionCookie = setCookieHeader.split(';')[0]

      assert.match(
        sessionCookie,
        /^campus_event_session=[0-9a-f]{64}$/,
      )
    })

    await t.step('GET /me liefert angemeldeten Benutzer', async () => {
      const response = await app.request('/api/auth/me', {
        headers: {
          Cookie: sessionCookie,
        },
      })

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.user.id, createdUserId)
      assert.equal(data.user.email, EMAIL)
      assert.equal(data.user.role, 'student')
      assert.equal(data.user.password_hash, undefined)

      assert.equal(
        response.headers.get('cache-control'),
        'no-store',
      )
    })

    await t.step('Logout löscht die Session', async () => {
      const response = await app.request('/api/auth/logout', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Cookie: sessionCookie,
        },
      })

      assert.equal(response.status, 200)

      const deletionHeader = response.headers.get('set-cookie')

      assert.ok(deletionHeader)
      assert.match(deletionHeader, /Max-Age=0/i)

      // Alter Token darf nicht mehr funktionieren
      const meResponse = await app.request('/api/auth/me', {
        headers: {
          Cookie: sessionCookie,
        },
      })

      assert.equal(meResponse.status, 401)
    })

    await t.step('Login-Begrenzung erkennt zu viele Versuche', () => {
      const rateLimitEmail =
        `limit-${crypto.randomUUID()}@example.com`

      for (let i = 0; i < 8; i++) {
        recordFailedLogin(rateLimitEmail)
      }

      assert.ok(getLoginRetryAfter(rateLimitEmail) > 0)

      clearFailedLogins(rateLimitEmail)

      assert.equal(getLoginRetryAfter(rateLimitEmail), 0)
    })

  } finally {

    // Nur den Benutzer dieses Testlaufs entfernen
    if (createdUserId !== null) {
      await sql`
        DELETE FROM sessions
        WHERE user_id = ${createdUserId}::uuid
      `

      await sql`
        DELETE FROM users
        WHERE id = ${createdUserId}::uuid
      `
    }

    await sql.end()
  }
})