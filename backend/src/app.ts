import { Hono } from 'hono'

import { registerEventRoutes } from './routes/eventRoutes.ts'
import { registerCategoryRoutes } from './routes/categoryRoutes.ts'
import { apiError } from './utils/apiError.ts'
import { registerAuthRoutes } from './routes/authRoutes.ts'
import {
  registerEventManagementRoutes,
} from './routes/eventManagementRoutes.ts'

// Hono-Anwendung erstellen
export const app = new Hono()

// Health-Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'CampusEvent API läuft',
  })
})

// REST-Routen registrieren
registerEventRoutes(app)
registerCategoryRoutes(app)
registerEventRoutes(app)
registerCategoryRoutes(app)
registerAuthRoutes(app)
registerEventRoutes(app)
registerCategoryRoutes(app)
registerAuthRoutes(app)
registerEventManagementRoutes(app)

// Einheitliche Antwort bei unbekannter Route
app.notFound((c) => {
  return c.json(
    apiError(
      'ROUTE_NOT_FOUND',
      'Der angeforderte Endpunkt existiert nicht.',
    ),
    404,
  )
})

// Zentrale Fehlerbehandlung
app.onError((error, c) => {
  console.error('API-Fehler:', error)

  return c.json(
    apiError(
      'INTERNAL_SERVER_ERROR',
      'Ein interner Serverfehler ist aufgetreten.',
    ),
    500,
  )
})