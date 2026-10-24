import { Hono } from 'hono'

const app = new Hono()

// Health-Check der API
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'CampusEvent API läuft',
  })
})

// HTTP-Server starten
Deno.serve({ port: 8000 }, app.fetch)