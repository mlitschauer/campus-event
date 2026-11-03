import { createMiddleware } from 'hono/factory'

import { apiError } from '../utils/apiError.ts'

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

export const requireTrustedOrigin =
  createMiddleware(async (c, next) => {
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

    await next()
  })