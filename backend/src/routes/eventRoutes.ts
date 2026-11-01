import type { Hono } from 'hono'

import {
  getPublishedEvents,
  getPublishedEventById,
} from '../services/eventService.ts'

import {
  eventQuerySchema,
  eventIdSchema,
} from '../schemas/eventSchema.ts'

import { apiError } from '../utils/apiError.ts'

export function registerEventRoutes(app: Hono): void {

  // GET /api/events
  app.get('/api/events', async (c) => {

    // Query-Parameter auslesen und validieren
    const result = eventQuerySchema.safeParse(c.req.query())

    if (!result.success) {
      return c.json(
        apiError(
          'VALIDATION_ERROR',
          'Ungültige Anfrageparameter.',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.') || 'query',
            message: issue.message,
          })),
        ),
        400,
      )
    }

    // Validierte Filter an den Service übergeben
    const events = await getPublishedEvents(result.data)

    return c.json(events, 200)
  })

  // GET /api/events/:id
  app.get('/api/events/:id', async (c) => {

    const result = eventIdSchema.safeParse(c.req.param('id'))

    if (!result.success) {
      return c.json(
        apiError(
          'VALIDATION_ERROR',
          'Die Event-ID muss eine gültige UUID sein.',
          [{
            field: 'id',
            message: 'Ungültiges UUID-Format.',
          }],
        ),
        400,
      )
    }

    const event = await getPublishedEventById(result.data)

    if (!event) {
      return c.json(
        apiError(
          'EVENT_NOT_FOUND',
          'Veranstaltung nicht gefunden.',
        ),
        404,
      )
    }

    return c.json(event, 200)
  })
}