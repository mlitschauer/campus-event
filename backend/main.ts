import { Hono } from 'hono'

import { registerEventRoutes } from './src/routes/eventRoutes.ts'
import { registerCategoryRoutes } from './src/routes/categoryRoutes.ts'

// Hono-Anwendung erstellen
const app = new Hono()

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

// Nicht vorhandene API-Routen
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Der angeforderte Endpunkt existiert nicht.',
      },
    },
    404,
  )
})

// Zentrale Fehlerbehandlung
app.onError((error, c) => {
  console.error('API-Fehler:', error)

  return c.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ein interner Serverfehler ist aufgetreten.',
      },
    },
    500,
  )
})

// HTTP-Server starten
Deno.serve({ port: 8000 }, app.fetch)