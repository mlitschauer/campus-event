import { app } from './src/app.ts'

// HTTP-Server starten
Deno.serve({ port: 8000 }, app.fetch)