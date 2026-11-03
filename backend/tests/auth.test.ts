import assert from 'node:assert/strict'

import { sql } from '../src/db/client.ts'

import {
  hashPassword,
  verifyPassword,
} from '../src/security/password.ts'

import {
  generateSessionToken,
  hashSessionToken,
} from '../src/security/sessionToken.ts'

import {
  createSession,
  getActiveSession,
  revokeSession,
} from '../src/services/sessionService.ts'

Deno.test('CE-16: Passwort- und Session-Sicherheit', async (t) => {
  const testTokens: string[] = []

  try {
    // TEST 1: Passwort-Hashing
    await t.step('Passwörter sicher hashen', async () => {
      const password = 'CampusEvent-Testpasswort-2026!'

      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      // Passwort wird nicht im Klartext gespeichert
      assert.notEqual(hash1, password)

      // Argon2id-Verfahren wird verwendet
      assert.ok(hash1.startsWith('$argon2id$'))

      // Unterschiedliche Salts liefern unterschiedliche Hashes
      assert.notEqual(hash1, hash2)

      // Richtiges Passwort wird akzeptiert
      assert.equal(
        await verifyPassword(password, hash1),
        true,
      )

      // Falsches Passwort wird abgelehnt
      assert.equal(
        await verifyPassword('FalschesPasswort', hash1),
        false,
      )

      // Ungültige Hashes werden abgelehnt
      assert.equal(
        await verifyPassword(
          password,
          '!DEMO_LOGIN_DISABLED!',
        ),
        false,
      )
    })

    // TEST 2: Session-Token-Erzeugung
    await t.step('Session-Tokens sind zufällig', async () => {
      const token1 = generateSessionToken()
      const token2 = generateSessionToken()

      assert.equal(token1.length, 64)
      assert.match(token1, /^[0-9a-f]{64}$/)

      // Zwei unabhängige Tokens müssen verschieden sein
      assert.notEqual(token1, token2)

      const tokenHash = await hashSessionToken(token1)

      assert.notEqual(token1, tokenHash)
    })

    // Testbenutzer aus CE-07 abrufen
    const users = await sql<{ id: string }[]>`
      SELECT id
      FROM users
      WHERE email = 'max@campusevent.example'
      LIMIT 1
    `

    const user = users[0]

    assert.ok(user, 'Demo-Benutzer nicht gefunden')

    // TEST 3: Session erstellen und überprüfen
    await t.step('Session erstellen und finden', async () => {
      const session = await createSession(user.id)
      testTokens.push(session.token)

      assert.ok(session.expiresAt > new Date())

      const storedHash = await hashSessionToken(
        session.token,
      )

      const rows = await sql<{ token_hash: string }[]>`
        SELECT token_hash
        FROM sessions
        WHERE token_hash = ${storedHash}
      `

      assert.equal(rows.length, 1)
      assert.equal(rows[0].token_hash, storedHash)

      // Original-Token darf nicht in der DB stehen
      assert.notEqual(
        rows[0].token_hash,
        session.token,
      )

      const activeSession = await getActiveSession(
        session.token,
      )

      assert.ok(activeSession)
      assert.equal(activeSession.user.id, user.id)
      assert.equal(activeSession.user.role, 'student')

      // Ungültiger Token wird abgelehnt
      assert.equal(
        await getActiveSession('invalid-token'),
        null,
      )

      // Session widerrufen
      assert.equal(
        await revokeSession(session.token),
        true,
      )

      // Widerrufener Token ist nicht mehr gültig
      assert.equal(
        await getActiveSession(session.token),
        null,
      )
    })

    // TEST 4: Session-Ablauf
    await t.step('Abgelaufene Session wird abgelehnt', async () => {
      const session = await createSession(user.id)
      testTokens.push(session.token)

      const tokenHash = await hashSessionToken(
        session.token,
      )

      // Ablaufzeit für den Test in die Vergangenheit setzen
      await sql`
        UPDATE sessions
        SET expires_at = NOW() - INTERVAL '1 second'
        WHERE token_hash = ${tokenHash}
      `

      const activeSession = await getActiveSession(
        session.token,
      )

      assert.equal(activeSession, null)
    })

  } finally {
    // Test-Sessions aufräumen
    for (const token of testTokens) {
      await revokeSession(token)
    }

    await sql.end()
  }
})