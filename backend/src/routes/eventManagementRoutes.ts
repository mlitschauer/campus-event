import type { Context, Hono } from 'hono'
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
  createEventSchema,
  updateEventSchema
} from '../schemas/eventManagementSchema.ts'

import {
  createManagedEvent,
  updateManagedEvent,
  removeManagedEvent,
  publishManagedEvent,
  cancelManagedEvent,
} from '../services/eventManagementService.ts'

import { apiError } from '../utils/apiError.ts'

// Nur JSON-Anfragen akzeptieren
function isJsonRequest(c: Context): boolean {
  const contentType =
    c.req.header('content-type') ?? ''

  return contentType
    .split(';')[0]
    .trim()
    .toLowerCase() === 'application/json'
}

// Zod-Fehler in unser bestehendes API-Format umwandeln
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

export function registerEventManagementRoutes(
  app: Hono,
): void {

  // ---------------------------------
  // POST /api/events
  // ---------------------------------
  app.post(
    '/api/events',
    requireAuth,
    requireRole('organizer'),
    requireTrustedOrigin,
    async (c) => {

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

      const result = createEventSchema.safeParse(body)

      if (!result.success) {
        return c.json(
          apiError(
            'VALIDATION_ERROR',
            'Ungültige Veranstaltungsdaten.',
            validationDetails(result.error.issues),
          ),
          400,
        )
      }

      // ID kommt ausschließlich aus der Session
      const organizerId = c.get('authUser').id

      const created = await createManagedEvent(
        organizerId,
        result.data,
      )

      if (created.kind === 'invalid-category') {
        return c.json(
          apiError(
            'CATEGORY_NOT_FOUND',
            'Die ausgewählte Kategorie existiert nicht.',
          ),
          400,
        )
      }

      if (created.kind !== 'success') {
        return c.json(
          apiError(
            'EVENT_CREATION_FAILED',
            'Die Veranstaltung konnte nicht erstellt werden.',
          ),
          409,
        )
      }

      return c.json({
        event: created.event,
      }, 201)
    },
  )

  // ---------------------------------
  // PATCH /api/events/:id
  // ---------------------------------
  app.patch(
    '/api/events/:id',
    requireAuth,
    requireRole('organizer'),
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

      const result = updateEventSchema.safeParse(body)

      if (!result.success) {
        return c.json(
          apiError(
            'VALIDATION_ERROR',
            'Ungültige Änderungsdaten.',
            validationDetails(result.error.issues),
          ),
          400,
        )
      }

      const organizerId = c.get('authUser').id

      const updated = await updateManagedEvent(
        idResult.data,
        organizerId,
        result.data,
      )

      if (updated.kind === 'not-found') {
        return c.json(
          apiError(
            'EVENT_NOT_FOUND',
            'Veranstaltung nicht gefunden.',
          ),
          404,
        )
      }

      if (updated.kind === 'invalid-category') {
        return c.json(
          apiError(
            'CATEGORY_NOT_FOUND',
            'Die ausgewählte Kategorie existiert nicht.',
          ),
          400,
        )
      }

      if (updated.kind === 'invalid-dates') {
        return c.json(
          apiError(
            'VALIDATION_ERROR',
            'Das Ende muss nach dem Beginn liegen.',
            [{
              field: 'endsAt',
              message: 'Das Ende muss nach dem Beginn liegen.',
            }],
          ),
          400,
        )
      }

      if (updated.kind === 'conflict') {
        return c.json(
          apiError(
            'EVENT_NOT_EDITABLE',
            'Die Veranstaltung kann momentan nicht bearbeitet werden.',
          ),
          409,
        )
      }

      return c.json({
        event: updated.event,
      }, 200)
    },
  )

  // ---------------------------------
  // DELETE /api/events/:id
  // ---------------------------------
  app.delete(
    '/api/events/:id',
    requireAuth,
    requireRole('organizer'),
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

      const organizerId = c.get('authUser').id

      const deleted = await removeManagedEvent(
        idResult.data,
        organizerId,
      )

      if (deleted.kind === 'not-found') {
        return c.json(
          apiError(
            'EVENT_NOT_FOUND',
            'Veranstaltung nicht gefunden.',
          ),
          404,
        )
      }

      if (deleted.kind === 'conflict') {
        return c.json(
          apiError(
            'EVENT_NOT_DELETABLE',
            'Die Veranstaltung kann nicht endgültig gelöscht werden.',
          ),
          409,
        )
      }

      // Erfolgreiches Löschen:
      // HTTP 204 enthält keinen Response-Body.
      return c.body(null, 204)
    },
  )

  // ---------------------------------
// POST /api/events/:id/publish
// ---------------------------------
app.post(
  '/api/events/:id/publish',
  requireAuth,
  requireRole('organizer'),
  requireTrustedOrigin,
  async (c) => {

    // UUID überprüfen
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

    // Authentifizierten Organizer abrufen
    const organizerId = c.get('authUser').id

    // Veröffentlichung durchführen
    const result = await publishManagedEvent(
      idResult.data,
      organizerId,
    )

    if (result.kind === 'not-found') {
      return c.json(
        apiError(
          'EVENT_NOT_FOUND',
          'Veranstaltung nicht gefunden.',
        ),
        404,
      )
    }

    if (result.kind === 'invalid-status') {
      return c.json(
        apiError(
          'INVALID_EVENT_STATUS',
          'Nur Entwürfe können veröffentlicht werden.',
        ),
        409,
      )
    }

    if (result.kind === 'event-started') {
      return c.json(
        apiError(
          'EVENT_START_PASSED',
          'Veranstaltungsbeginn muss in der Zukunft liegen.',
        ),
        409,
      )
    }

    if (result.kind === 'conflict') {
      return c.json(
        apiError(
          'EVENT_STATUS_CONFLICT',
          'Der Veranstaltungsstatus hat sich geändert.',
        ),
        409,
      )
    }

    return c.json({
      event: result.event,
    }, 200)
  },
)

// ---------------------------------
// POST /api/events/:id/cancel
// ---------------------------------
app.post(
  '/api/events/:id/cancel',
  requireAuth,
  requireRole('organizer'),
  requireTrustedOrigin,
  async (c) => {

    // UUID überprüfen
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

    // Authentifizierten Organizer abrufen
    const organizerId = c.get('authUser').id

    // Absage durchführen
    const result = await cancelManagedEvent(
      idResult.data,
      organizerId,
    )

    if (result.kind === 'not-found') {
      return c.json(
        apiError(
          'EVENT_NOT_FOUND',
          'Veranstaltung nicht gefunden.',
        ),
        404,
      )
    }

    if (result.kind === 'invalid-status') {
      return c.json(
        apiError(
          'INVALID_EVENT_STATUS',
          'Nur veröffentlichte Veranstaltungen können abgesagt werden.',
        ),
        409,
      )
    }

    if (result.kind !== 'success') {
  return c.json(
    apiError(
      'EVENT_STATUS_CONFLICT',
      'Der Veranstaltungsstatus hat sich geändert.',
    ),
    409,
  )
}

return c.json({
  event: result.event,
}, 200)
  },
)
}