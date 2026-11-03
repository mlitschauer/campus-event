import { sql } from '../db/client.ts'

import type {
  CreateEventInput,
  UpdateEventInput,
} from '../schemas/eventManagementSchema.ts'

export type EventStatus =
  | 'draft'
  | 'published'
  | 'cancelled'

export interface ManagedEvent {
  id: string
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  capacity: number
  status: EventStatus

  organizer: {
    id: string
    name: string
  }

  category: {
    id: string
    name: string
    slug: string
  }
}

// Interne Datenbankstruktur
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

// Datenbankzeile in öffentliches API-Format umwandeln
function mapEvent(row: EventRow): ManagedEvent {
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

// Kategorie überprüfen
export async function categoryExists(
  categoryId: string,
): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM categories
      WHERE id = ${categoryId}::uuid
    ) AS exists
  `

  return rows[0]?.exists ?? false
}

// Event ausschließlich für seinen Besitzer abrufen
export async function findOwnedEventById(
  eventId: string,
  organizerId: string,
): Promise<ManagedEvent | null> {
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

    WHERE e.id = ${eventId}::uuid
      AND e.organizer_id = ${organizerId}::uuid

    LIMIT 1
  `

  return rows[0] ? mapEvent(rows[0]) : null
}

// Neues Event als Entwurf erstellen
export async function insertDraftEvent(
  organizerId: string,
  input: CreateEventInput,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO events (
      title,
      description,
      location,
      starts_at,
      ends_at,
      capacity,
      status,
      organizer_id,
      category_id
    )

    SELECT
      ${input.title},
      ${input.description},
      ${input.location},
      ${input.startsAt}::timestamptz,
      ${input.endsAt}::timestamptz,
      ${input.capacity},
      'draft',
      ${organizerId}::uuid,
      c.id

    FROM categories c
    WHERE c.id = ${input.categoryId}::uuid

    RETURNING id
  `

  return rows[0]?.id ?? null
}

// Eigenen Entwurf bearbeiten
export async function updateDraftEvent(
  eventId: string,
  organizerId: string,
  input: UpdateEventInput,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE events
    SET
      title = COALESCE(
        ${input.title ?? null}::text,
        title
      ),

      description = COALESCE(
        ${input.description ?? null}::text,
        description
      ),

      location = COALESCE(
        ${input.location ?? null}::text,
        location
      ),

      starts_at = COALESCE(
        ${input.startsAt ?? null}::timestamptz,
        starts_at
      ),

      ends_at = COALESCE(
        ${input.endsAt ?? null}::timestamptz,
        ends_at
      ),

      capacity = COALESCE(
        ${input.capacity ?? null}::integer,
        capacity
      ),

      category_id = COALESCE(
        ${input.categoryId ?? null}::uuid,
        category_id
      ),

      updated_at = NOW()

    WHERE id = ${eventId}::uuid
      AND organizer_id = ${organizerId}::uuid
      AND status = 'draft'

      AND COALESCE(
        ${input.startsAt ?? null}::timestamptz,
        starts_at
      ) < COALESCE(
        ${input.endsAt ?? null}::timestamptz,
        ends_at
      )

      AND (
        ${input.categoryId ?? null}::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM categories
          WHERE id = ${input.categoryId ?? null}::uuid
        )
      )

    RETURNING id
  `

  return rows.length > 0
}

// Eigenen Entwurf endgültig löschen
export async function deleteDraftEvent(
  eventId: string,
  organizerId: string,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM events AS e

    WHERE e.id = ${eventId}::uuid
      AND e.organizer_id = ${organizerId}::uuid
      AND e.status = 'draft'

      AND NOT EXISTS (
        SELECT 1
        FROM registrations r
        WHERE r.event_id = e.id
      )

    RETURNING e.id
  `

  return rows.length > 0
}

// Eigenen Entwurf veröffentlichen
export async function publishDraftEvent(
  eventId: string,
  organizerId: string,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE events
    SET
      status = 'published',
      updated_at = NOW()

    WHERE id = ${eventId}::uuid
      AND organizer_id = ${organizerId}::uuid
      AND status = 'draft'
      AND starts_at > NOW()
      AND ends_at > starts_at

    RETURNING id
  `

  return rows.length === 1
}

// Eigene veröffentlichte Veranstaltung absagen
export async function cancelPublishedEvent(
  eventId: string,
  organizerId: string,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE events
    SET
      status = 'cancelled',
      updated_at = NOW()

    WHERE id = ${eventId}::uuid
      AND organizer_id = ${organizerId}::uuid
      AND status = 'published'

    RETURNING id
  `

  return rows.length === 1
}