import {
  generateSessionToken,
  hashSessionToken,
  isValidSessionToken,
} from '../security/sessionToken.ts'

import {
  insertSession,
  findActiveSessionByHash,
  deleteSessionByHash,
} from '../repositories/sessionRepository.ts'

import type {
  ActiveSession,
} from '../repositories/sessionRepository.ts'

// Session ist 7 Tage gültig
const SESSION_DURATION_MS =
  7 * 24 * 60 * 60 * 1000

export interface CreatedSession {
  token: string
  expiresAt: Date
}

// Neue Session für einen Benutzer erstellen
export async function createSession(
  userId: string,
): Promise<CreatedSession> {
  const token = generateSessionToken()

  const tokenHash = await hashSessionToken(token)

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_MS,
  )

  await insertSession(
    userId,
    tokenHash,
    expiresAt,
  )

  // Original-Token wird nur an den aufrufenden
  // Auth-Service zurückgegeben, nicht gespeichert.
  return {
    token,
    expiresAt,
  }
}

// Session überprüfen
export async function getActiveSession(
  token: string,
): Promise<ActiveSession | null> {
  if (!isValidSessionToken(token)) {
    return null
  }

  const tokenHash = await hashSessionToken(token)

  return await findActiveSessionByHash(tokenHash)
}

// Session widerrufen
export async function revokeSession(
  token: string,
): Promise<boolean> {
  if (!isValidSessionToken(token)) {
    return false
  }

  const tokenHash = await hashSessionToken(token)

  return await deleteSessionByHash(tokenHash)
}