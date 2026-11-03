import type { Context, Hono } from 'hono'

import {
  getCookie,
  setCookie,
  deleteCookie,
} from 'hono/cookie'

import {
  registerSchema,
  loginSchema,
} from '../schemas/authSchema.ts'

import {
  registerUser,
  loginUser,
} from '../services/authService.ts'

import {
  getActiveSession,
  revokeSession,
} from '../services/sessionService.ts'

import {
  getLoginRetryAfter,
  recordFailedLogin,
  clearFailedLogins,
} from '../security/loginRateLimit.ts'

import { apiError } from '../utils/apiError.ts'

// Cookie-Konfiguration
const COOKIE_NAME = 'campus_event_session'
const COOKIE_PATH = '/api'

const isProduction =
  Deno.env.get('APP_ENV') === 'production'

const configuredOrigin =
  Deno.env.get('FRONTEND_ORIGIN') ??
  (isProduction ? '' : 'http://localhost:5173')

if (!configuredOrigin) {
  throw new Error('FRONTEND_ORIGIN fehlt.')
}

const trustedOrigin = new URL(configuredOrigin).origin

if (
  isProduction &&
  !trustedOrigin.startsWith('https://')
) {
  throw new Error(
    'FRONTEND_ORIGIN muss in Produktion HTTPS verwenden.',
  )
}

// Nur JSON als Anfrageformat erlauben
function isJsonRequest(c: Context): boolean {
  const contentType =
    c.req.header('content-type') ?? ''

  return contentType
    .split(';')[0]
    .trim()
    .toLowerCase() === 'application/json'
}

// Einheitliche Zod-Validierungsfehler
function validationDetails(
  issues: Array<{
    path: PropertyKey[]
    message: string
  }>,
) {
  return issues.map((issue) => ({
    field: issue.path.map(String).join('.') || 'body',
    message: issue.message,
  }))
}

export function registerAuthRoutes(app: Hono): void {

  // Schutz für alle Auth-Routen
  app.use('/api/auth/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')

    // Zustandsverändernde Anfragen:
    // nur von der erlaubten Frontend-Origin
    if (c.req.method !== 'GET') {
      const origin = c.req.header('origin')

      if (origin !== trustedOrigin) {
        return c.json(
          apiError(
            'FORBIDDEN_ORIGIN',
            'Anfrage von nicht erlaubter Herkunft.',
          ),
          403,
        )
      }
    }

    await next()
  })

  // ---------------------------------
  // POST /api/auth/register
  // ---------------------------------
  app.post('/api/auth/register', async (c) => {

    if (!isJsonRequest(c)) {
      return c.json(
        apiError(
          'UNSUPPORTED_MEDIA_TYPE',
          'Es wird application/json erwartet.',
        ),
        415,
      )
    }

    const body: unknown = await c.req.json()
      .catch(() => null)

    const result = registerSchema.safeParse(body)

    if (!result.success) {
      return c.json(
        apiError(
          'VALIDATION_ERROR',
          'Ungültige Registrierungsdaten.',
          validationDetails(result.error.issues),
        ),
        400,
      )
    }

    const user = await registerUser(result.data)

    if (!user) {
      return c.json(
        apiError(
          'EMAIL_ALREADY_EXISTS',
          'Für diese E-Mail-Adresse existiert bereits ein Konto.',
        ),
        409,
      )
    }

    return c.json({ user }, 201)
  })

  // ---------------------------------
  // POST /api/auth/login
  // ---------------------------------
  app.post('/api/auth/login', async (c) => {

    if (!isJsonRequest(c)) {
      return c.json(
        apiError(
          'UNSUPPORTED_MEDIA_TYPE',
          'Es wird application/json erwartet.',
        ),
        415,
      )
    }

    const body: unknown = await c.req.json()
      .catch(() => null)

    const result = loginSchema.safeParse(body)

    if (!result.success) {
      return c.json(
        apiError(
          'VALIDATION_ERROR',
          'Ungültige Anmeldedaten.',
          validationDetails(result.error.issues),
        ),
        400,
      )
    }

    const { email } = result.data

    // Zu viele fehlgeschlagene Versuche?
    const retryAfter = getLoginRetryAfter(email)

    if (retryAfter > 0) {
      c.header('Retry-After', String(retryAfter))

      return c.json(
        apiError(
          'TOO_MANY_ATTEMPTS',
          'Zu viele Anmeldeversuche. Bitte später erneut versuchen.',
        ),
        429,
      )
    }

    // Passwort überprüfen und Session erstellen
    const login = await loginUser(result.data)

    if (!login) {
      recordFailedLogin(email)

      return c.json(
        apiError(
          'INVALID_CREDENTIALS',
          'E-Mail-Adresse oder Passwort ist falsch.',
        ),
        401,
      )
    }

    clearFailedLogins(email)

    // Cookie-Laufzeit aus der Session berechnen
    const maxAge = Math.max(
      0,
      Math.floor(
        (login.session.expiresAt.getTime() - Date.now()) / 1000,
      ),
    )

    // Original-Token nur ins HttpOnly-Cookie schreiben
    setCookie(c, COOKIE_NAME, login.session.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Lax',
      path: COOKIE_PATH,
      maxAge,
      expires: login.session.expiresAt,
    })

    // Token ausdrücklich NICHT im JSON zurückgeben
    return c.json({
      user: login.user,
    }, 200)
  })

  // ---------------------------------
  // GET /api/auth/me
  // ---------------------------------
  app.get('/api/auth/me', async (c) => {

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

    return c.json({
      user: session.user,
    }, 200)
  })

  // ---------------------------------
  // POST /api/auth/logout
  // ---------------------------------
  app.post('/api/auth/logout', async (c) => {

    const token = getCookie(c, COOKIE_NAME)

    if (token) {
      await revokeSession(token)
    }

    // Cookie im Browser entfernen
    deleteCookie(c, COOKIE_NAME, {
      path: COOKIE_PATH,
      secure: isProduction,
    })

    return c.json({
      message: 'Erfolgreich abgemeldet.',
    }, 200)
  })
}