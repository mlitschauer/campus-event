import { sql } from '../db/client.ts'

// Benutzerrollen aus unserem Datenbankschema
export type UserRole = 'student' | 'organizer'

// Daten eines authentifizierten Benutzers
export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: UserRole
}

// Gültige Session mit Benutzerinformationen
export interface ActiveSession {
  sessionId: string
  user: AuthenticatedUser
  expiresAt: Date
}

// Interne SQL-Ergebnisstruktur
interface SessionRow {
  session_id: string
  user_id: string
  name: string
  email: string
  role: UserRole
  expires_at: Date
}

// Session speichern
export async function insertSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await sql`
    INSERT INTO sessions (
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      ${userId}::uuid,
      ${tokenHash},
      ${expiresAt.toISOString()}::timestamptz
    )
  `
}

// Aktive Session anhand ihres Hashes finden
export async function findActiveSessionByHash(
  tokenHash: string,
): Promise<ActiveSession | null> {
  const rows = await sql<SessionRow[]>`
    SELECT
      s.id AS session_id,
      s.expires_at,

      u.id AS user_id,
      u.name,
      u.email,
      u.role

    FROM sessions s

    JOIN users u
      ON s.user_id = u.id

    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()

    LIMIT 1
  `

  const row = rows[0]

  if (!row) {
    return null
  }

  return {
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
    },
  }
}

// Session dauerhaft löschen
export async function deleteSessionByHash(
  tokenHash: string,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM sessions
    WHERE token_hash = ${tokenHash}
    RETURNING id
  `

  return rows.length > 0
}