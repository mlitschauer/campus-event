import postgres from 'postgres'

const databaseUrl = Deno.env.get('DATABASE_URL')

if (!databaseUrl) {
  throw new Error('DATABASE_URL ist nicht konfiguriert')
}

export const sql = postgres(databaseUrl, {
  max: 5,
})