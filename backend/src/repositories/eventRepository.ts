import { sql } from '../db/client.ts'

import type {
  CampusEvent,
  EventStatus,
  EventFilters,
} from '../types/event.ts'

// Interne Struktur einer SQL-Ergebniszeile
interface EventRow {
  id: string
  title: string
  description: string
  location: string

  starts_at: Date
  ends_at: Date

  capacity: number
  status: EventStatus

  organizer_id: string
  organizer_name: string

  category_id: string
  category_name: string
  category_slug: string
}

// Datenbankzeile in Anwendungsobjekt umwandeln
function mapEvent(row: EventRow): CampusEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,

    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),

    capacity: row.capacity,
    status: row.status,

    organizer: {
      id: row.organizer_id,
      name: row.organizer_name,
    },

    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
  }
}

// Alle veröffentlichten Veranstaltungen abrufen
export async function findPublishedEvents(
  filters: EventFilters = {},
): Promise<CampusEvent[]> {

  const rows = await sql<EventRow[]>`
    SELECT
      e.id,
      e.title,
      e.description,
      e.location,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.status,

      u.id AS organizer_id,
      u.name AS organizer_name,

      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug

    FROM events e

    JOIN users u
      ON e.organizer_id = u.id

    JOIN categories c
      ON e.category_id = c.id

    WHERE e.status = 'published'

    ${filters.category
      ? sql`AND c.slug = ${filters.category}`
      : sql``
    }

    ${filters.search
      ? sql`
        AND (
          POSITION(LOWER(${filters.search}) IN LOWER(e.title)) > 0
          OR POSITION(LOWER(${filters.search}) IN LOWER(e.description)) > 0
          OR POSITION(LOWER(${filters.search}) IN LOWER(e.location)) > 0
        )
      `
      : sql``
    }

    ORDER BY e.starts_at ASC
  `

  return rows.map(mapEvent)
}

// Einzelne veröffentlichte Veranstaltung abrufen
export async function findPublishedEventById(
  id: string,
): Promise<CampusEvent | null> {
  const rows = await sql<EventRow[]>`
    SELECT
      e.id,
      e.title,
      e.description,
      e.location,
      e.starts_at,
      e.ends_at,
      e.capacity,
      e.status,

      u.id AS organizer_id,
      u.name AS organizer_name,

      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug

    FROM events e

    JOIN users u
      ON e.organizer_id = u.id

    JOIN categories c
      ON e.category_id = c.id

    WHERE e.id = ${id}::uuid
      AND e.status = 'published'
  `

  const event = rows[0]

  return event ? mapEvent(event) : null
}