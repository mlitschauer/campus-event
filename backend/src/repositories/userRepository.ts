import { sql } from '../db/client.ts'

export type UserRole = 'student' | 'organizer'

export interface PublicUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface UserWithPassword extends PublicUser {
  password_hash: string
}

interface NewUser {
  name: string
  email: string
  passwordHash: string
}

// Neues Studenten-Konto erstellen
export async function createStudentUser(
  input: NewUser,
): Promise<PublicUser | null> {
  const rows = await sql<PublicUser[]>`
    INSERT INTO users (
      name,
      email,
      password_hash,
      role
    )
    VALUES (
      ${input.name},
      ${input.email},
      ${input.passwordHash},
      'student'
    )
    ON CONFLICT DO NOTHING
    RETURNING id, name, email, role
  `

  return rows[0] ?? null
}

// Benutzer für die Passwortprüfung abrufen
export async function findUserByEmail(
  email: string,
): Promise<UserWithPassword | null> {
  const rows = await sql<UserWithPassword[]>`
    SELECT
      id,
      name,
      email,
      role,
      password_hash
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `

  return rows[0] ?? null
}