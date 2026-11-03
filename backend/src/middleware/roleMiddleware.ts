import { createMiddleware } from 'hono/factory'

import { apiError } from '../utils/apiError.ts'

import type { AuthEnv } from './authMiddleware.ts'
import type {
  UserRole,
} from '../repositories/sessionRepository.ts'

// Rollenbasierte Berechtigungsprüfung
export function requireRole(
  ...allowedRoles: UserRole[]
) {
  return createMiddleware<AuthEnv>(
    async (c, next) => {

      // Benutzer wurde von requireAuth gesetzt
      const user = c.get('authUser')

      // Sicherheitsprüfung:
      // Middleware muss auch ohne vorherige
      // Authentifizierung den Zugriff verweigern
      if (!user) {
        return c.json(
          apiError(
            'UNAUTHORIZED',
            'Nicht angemeldet.',
          ),
          401,
        )
      }

      // Prüfen, ob Rolle erlaubt ist
      if (!allowedRoles.includes(user.role)) {
        return c.json(
          apiError(
            'FORBIDDEN',
            'Keine Berechtigung für diese Aktion.',
          ),
          403,
        )
      }

      await next()
    },
  )
}