import type { Hono } from 'hono'

import {
  getPublishedEvents,
  getPublishedEventById,
} from '../services/eventService.ts'

// Einfacher UUID-Formatcheck
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function registerEventRoutes(app: Hono): void {

  // GET /api/events
  app.get('/api/events', async (c) => {
    const events = await getPublishedEvents()

    return c.json(events, 200)
  })

  // GET /api/events/:id
  app.get('/api/events/:id', async (c) => {
    const id = c.req.param('id')

    // ID auf gültiges UUID-Format prüfen
    if (!UUID_REGEX.test(id)) {
      return c.json(
        {
          error: {
            code: 'INVALID_EVENT_ID',
            message: 'Die Event-ID muss eine gültige UUID sein.',
          },
        },
        400,
      )
    }

    // Event über Service abrufen
    const event = await getPublishedEventById(id)

    // Event existiert nicht oder ist nicht veröffentlicht
    if (!event) {
      return c.json(
        {
          error: {
            code: 'EVENT_NOT_FOUND',
            message: 'Veranstaltung nicht gefunden.',
          },
        },
        404,
      )
    }

    return c.json(event, 200)
  })
}