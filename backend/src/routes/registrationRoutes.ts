import type { Hono } from 'hono'
import { z } from 'zod'

import {
  requireAuth,
} from '../middleware/authMiddleware.ts'

import {
  requireRole,
} from '../middleware/roleMiddleware.ts'

import {
  requireTrustedOrigin,
} from '../middleware/trustedOriginMiddleware.ts'

import {
  registerForEvent,
  unregisterFromEvent,
} from '../services/registrationService.ts'

import { apiError } from '../utils/apiError.ts'

export function registerRegistrationRoutes(
  app: Hono,
): void {

  // ----------------------------------
  // POST /api/events/:id/registrations
  // ----------------------------------
  app.post(
    '/api/events/:id/registrations',

    requireAuth,
    requireRole('student'),
    requireTrustedOrigin,

    async (c) => {

      const idResult = z.uuid().safeParse(
        c.req.param('id'),
      )

      if (!idResult.success) {
        return c.json(
          apiError(
            'VALIDATION_ERROR',
            'Ungültige Event-ID.',
          ),
          400,
        )
      }

      // Die User-ID kommt ausschließlich
      // aus der authentifizierten Session
      const studentId = c.get('authUser').id

      const result = await registerForEvent(
        idResult.data,
        studentId,
      )

      switch (result.kind) {
        case 'event-not-found':
          return c.json(
            apiError(
              'EVENT_NOT_FOUND',
              'Veranstaltung nicht gefunden.',
            ),
            404,
          )

        case 'event-not-open':
          return c.json(
            apiError(
              'EVENT_NOT_OPEN',
              'Anmeldungen sind nur für veröffentlichte Veranstaltungen möglich.',
            ),
            409,
          )

        case 'event-started':
          return c.json(
            apiError(
              'EVENT_ALREADY_STARTED',
              'Die Veranstaltung hat bereits begonnen.',
            ),
            409,
          )

        case 'already-registered':
          return c.json(
            apiError(
              'ALREADY_REGISTERED',
              'Du bist bereits für diese Veranstaltung angemeldet.',
            ),
            409,
          )

        case 'event-full':
          return c.json(
            apiError(
              'EVENT_FULL',
              'Für diese Veranstaltung sind keine Plätze mehr frei.',
            ),
            409,
          )

        case 'registered':
          c.header('Cache-Control', 'no-store')

          return c.json(
            { registration: result.registration },
            201,
          )
      }
    },
  )

  // ----------------------------------
  // DELETE /api/events/:id/registrations/me
  // ----------------------------------
  app.delete(
    '/api/events/:id/registrations/me',

    requireAuth,
    requireRole('student'),
    requireTrustedOrigin,

    async (c) => {

      const idResult = z.uuid().safeParse(
        c.req.param('id'),
      )

      if (!idResult.success) {
        return c.json(
          apiError(
            'VALIDATION_ERROR',
            'Ungültige Event-ID.',
          ),
          400,
        )
      }

      const studentId = c.get('authUser').id

      const result = await unregisterFromEvent(
        idResult.data,
        studentId,
      )

      switch (result.kind) {
        case 'event-not-found':
          return c.json(
            apiError(
              'EVENT_NOT_FOUND',
              'Veranstaltung nicht gefunden.',
            ),
            404,
          )

        case 'event-started':
          return c.json(
            apiError(
              'EVENT_ALREADY_STARTED',
              'Nach Veranstaltungsbeginn ist eine Abmeldung nicht mehr möglich.',
            ),
            409,
          )

        case 'not-registered':
          return c.json(
            apiError(
              'REGISTRATION_NOT_FOUND',
              'Du bist für diese Veranstaltung nicht angemeldet.',
            ),
            404,
          )

        case 'unregistered':
          c.header('Cache-Control', 'no-store')

          // Erfolgreiche DELETE-Anfrage ohne Response-Body
          return c.body(null, 204)
      }
    },
  )
}