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
}