import type { Hono } from 'hono'

import {
  requireAuth,
} from '../middleware/authMiddleware.ts'

import {
  requireRole,
} from '../middleware/roleMiddleware.ts'

import {
  findEventsByOrganizer,
} from '../repositories/eventManagementRepository.ts'

import { z } from 'zod'

import {
  findOwnedEventById,
} from '../repositories/eventManagementRepository.ts'

import { apiError } from '../utils/apiError.ts'

export function registerOrganizerRoutes(
  app: Hono,
): void {

  // ---------------------------------
  // GET /api/organizer/events
  // ---------------------------------
  app.get(
    '/api/organizer/events',

    requireAuth,
    requireRole('organizer'),

    async (c) => {
      // Die ID stammt aus der geprüften Session
      const organizerId = c.get('authUser').id

      const events = await findEventsByOrganizer(
        organizerId,
      )

      return c.json({
        events,
      }, 200)
    },
  )

  // ---------------------------------
  // GET /api/organizer/events/:id
  // ---------------------------------
  app.get(
    '/api/organizer/events/:id',

    requireAuth,
    requireRole('organizer'),

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

      // Niemals eine Organizer-ID aus der URL
      // oder einem Query-Parameter übernehmen.
      const organizerId = c.get('authUser').id

      const event = await findOwnedEventById(
        idResult.data,
        organizerId,
      )

      if (!event) {
        return c.json(
          apiError(
            'EVENT_NOT_FOUND',
            'Veranstaltung nicht gefunden.',
          ),
          404,
        )
      }

      return c.json({ event }, 200)
    },
  )
}