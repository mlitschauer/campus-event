import { sql } from './client.ts'

try {
  const rows = await sql`
    SELECT
      current_database() AS database_name,
      COUNT(*)::integer AS table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'categories',
        'events',
        'registrations',
        'sessions'
      )
  `

  const result = rows[0]

  if (Number(result.table_count) !== 5) {
    throw new Error('Datenbankschema ist unvollständig')
  }

  console.log('Datenbankverbindung erfolgreich!')
  console.log('Datenbank:', result.database_name)
  console.log('Tabellen:', result.table_count)
} finally {
  await sql.end()
}