import { sql } from '../db/client.ts'

export interface Registration {
  id: string
  eventId: string
  userId: string
  createdAt: string
}

interface RegistrationRow {
  id: string
  event_id: string
  user_id: string
  created_at: Date
}

interface EventRow {
  id: string
  status: 'draft' | 'published' | 'cancelled'
  capacity: number
  starts_at: Date
}

export type RegisterResult =
  | { kind: 'registered'; registration: Registration }
  | { kind: 'event-not-found' }
  | { kind: 'event-not-open' }
  | { kind: 'event-started' }
  | { kind: 'already-registered' }
  | { kind: 'event-full' }

export type UnregisterResult =
  | { kind: 'unregistered' }
  | { kind: 'event-not-found' }
  | { kind: 'event-started' }
  | { kind: 'not-registered' }

function mapRegistration(
  row: RegistrationRow,
): Registration {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
  }
}

// ----------------------------------
// Für eine Veranstaltung anmelden
// ----------------------------------
export async function insertRegistration(
  eventId: string,
  userId: string,
): Promise<RegisterResult> {
  return await sql.begin(
    async (tx): Promise<RegisterResult> => {

      // 1. Event-Zeile exklusiv sperren
      const eventRows = await tx<EventRow[]>`
        SELECT
          id,
          status,
          capacity,
          starts_at
        FROM events
        WHERE id = ${eventId}::uuid
        FOR UPDATE
      `

      const event = eventRows[0]

      if (!event) {
        return { kind: 'event-not-found' }
      }

      // 2. Nur veröffentlichte Events zulassen
      if (event.status !== 'published') {
        return { kind: 'event-not-open' }
      }

      // 3. Anmeldung nach Veranstaltungsbeginn verhindern
      if (
        new Date(event.starts_at).getTime() <= Date.now()
      ) {
        return { kind: 'event-started' }
      }

      // 4. Doppelte Anmeldung prüfen
      const existing = await tx<{ id: string }[]>`
        SELECT id
        FROM registrations
        WHERE event_id = ${eventId}::uuid
          AND user_id = ${userId}::uuid
        LIMIT 1
      `

      if (existing.length > 0) {
        return { kind: 'already-registered' }
      }

      // 5. Belegte Plätze zählen
      const countRows = await tx<{ total: number }[]>`
        SELECT COUNT(*)::integer AS total
        FROM registrations
        WHERE event_id = ${eventId}::uuid
      `

      const occupied = countRows[0]?.total ?? 0

      if (occupied >= event.capacity) {
        return { kind: 'event-full' }
      }

      // 6. Anmeldung speichern
      const rows = await tx<RegistrationRow[]>`
        INSERT INTO registrations (
          event_id,
          user_id
        )
        VALUES (
          ${eventId}::uuid,
          ${userId}::uuid
        )

        ON CONFLICT (event_id, user_id)
        DO NOTHING

        RETURNING
          id,
          event_id,
          user_id,
          created_at
      `

      // Zusätzliche Absicherung über UNIQUE-Constraint
      if (rows.length === 0) {
        return { kind: 'already-registered' }
      }

      return {
        kind: 'registered',
        registration: mapRegistration(rows[0]),
      }
    },
  )
}

// ----------------------------------
// Eigene Anmeldung zurückziehen
// ----------------------------------
export async function deleteOwnRegistration(
  eventId: string,
  userId: string,
): Promise<UnregisterResult> {
  return await sql.begin(
    async (tx): Promise<UnregisterResult> => {

      // Event sperren, damit An- und Abmeldungen
      // denselben Sperrmechanismus verwenden
      const eventRows = await tx<{
        starts_at: Date
      }[]>`
        SELECT starts_at
        FROM events
        WHERE id = ${eventId}::uuid
        FOR UPDATE
      `

      if (eventRows.length === 0) {
        return { kind: 'event-not-found' }
      }

      // Nach Veranstaltungsbeginn keine Abmeldung
      if (
        new Date(eventRows[0].starts_at).getTime() <=
        Date.now()
      ) {
        return { kind: 'event-started' }
      }

      // Ausschließlich die eigene Registrierung entfernen
      const rows = await tx<{ id: string }[]>`
        DELETE FROM registrations
        WHERE event_id = ${eventId}::uuid
          AND user_id = ${userId}::uuid
        RETURNING id
      `

      if (rows.length === 0) {
        return { kind: 'not-registered' }
      }

      return { kind: 'unregistered' }
    },
  )
}