import {
  createStudentUser,
  findUserByEmail,
} from '../repositories/userRepository.ts'

import type {
  PublicUser,
} from '../repositories/userRepository.ts'

import {
  hashPassword,
  verifyPassword,
} from '../security/password.ts'

import {
  createSession,
} from './sessionService.ts'

import type {
  CreatedSession,
} from './sessionService.ts'

import type {
  RegisterInput,
  LoginInput,
} from '../schemas/authSchema.ts'

export interface LoginResult {
  user: PublicUser
  session: CreatedSession
}

// Vergleichshash, auch wenn kein Konto existiert.
// Verhindert einen auffälligen Unterschied zwischen
// "Benutzer unbekannt" und "Passwort falsch".
let dummyHashPromise: Promise<string> | undefined

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(
    'CampusEvent-Internal-Dummy-Password-2026!',
  )

  return dummyHashPromise
}

// Benutzer registrieren
export async function registerUser(
  input: RegisterInput,
): Promise<PublicUser | null> {
  const passwordHash = await hashPassword(input.password)

  return await createStudentUser({
    name: input.name,
    email: input.email,
    passwordHash,
  })
}

// Benutzer anmelden
export async function loginUser(
  input: LoginInput,
): Promise<LoginResult | null> {
  const user = await findUserByEmail(input.email)

  // Demo-Accounts aus CE-07 haben keinen
  // verwendbaren Passwort-Hash.
  const usableHash = user?.password_hash.startsWith('$argon2id$')
    ? user.password_hash
    : await getDummyHash()

  const passwordValid = await verifyPassword(
    input.password,
    usableHash,
  )

  if (
    !user ||
    !user.password_hash.startsWith('$argon2id$') ||
    !passwordValid
  ) {
    return null
  }

  // Erst nach erfolgreicher Passwortprüfung
  // eine neue Session anlegen.
  const session = await createSession(user.id)

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    session,
  }
}