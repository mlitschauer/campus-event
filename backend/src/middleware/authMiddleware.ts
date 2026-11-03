import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'

import { getActiveSession } from '../services/sessionService.ts'
import { apiError } from '../utils/apiError.ts'

import type {
  AuthenticatedUser,
} from '../repositories/sessionRepository.ts'

// Typisierte Werte für den Hono-Request-Kontext
export type AuthEnv = {
  Variables: {
    authUser: AuthenticatedUser
    authSessionId: string
  }
}

const COOKIE_NAME = 'campus_event_session'

// Authentifizierungsmiddleware
export const requireAuth = createMiddleware<AuthEnv>(
  async (c, next) => {
    // Geschützte Antworten nicht zwischenspeichern
    c.header('Cache-Control', 'no-store')

    // Session-Cookie auslesen
    const token = getCookie(c, COOKIE_NAME)

    if (!token) {
      return c.json(
        apiError(
          'UNAUTHORIZED',
          'Nicht angemeldet.',
        ),
        401,
      )
    }

    // Session serverseitig überprüfen
    const session = await getActiveSession(token)

    if (!session) {
      return c.json(
        apiError(
          'UNAUTHORIZED',
          'Session ungültig oder abgelaufen.',
        ),
        401,
      )
    }

    // Benutzerinformationen für nachfolgende
    // Middleware und Route-Handler bereitstellen
    c.set('authUser', session.user)
    c.set('authSessionId', session.sessionId)

    // Anfrage weiterverarbeiten
    await next()
  },
)