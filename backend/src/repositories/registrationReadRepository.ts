
import { sql } from '../db/client.ts'

import {
  mapEvent,
} from './eventManagementRepository.ts'

import type {
  EventRow,
  ManagedEvent,
} from './eventManagementRepository.ts'

// ----------------------------------
// Typen
// ----------------------------------

export interface MyRegistration {
  id: string
  registeredAt: string
  event: ManagedEvent
}

interface RegistrationWithEventRow extends EventRow {
  registration_id: string
  registration_created_at: Date
}

interface AvailabilityRow {
  id: string
  capacity: number
  registered_count: number
  is_registered: boolean
  starts_in_future: boolean
}

export interface RegistrationSnapshot {
  eventId: string
  capacity: number
  registeredCount: number
  isRegistered: boolean
  startsInFuture: boolean
}

// ----------------------------------
// Alle Anmeldungen eines Studenten
// ----------------------------------

export async function findRegistrationsByStudent(
  studentId: string,
): Promise<MyRegistration[]> {

  const rows = await sql<RegistrationWithEventRow[]>`
    SELECT
      r.id AS registration_id,
      r.created_at AS registration_created_at,

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

    FROM registrations r

    JOIN events e
      ON r.event_id = e.id

    JOIN users u
      ON e.organizer_id = u.id

    JOIN categories c
      ON e.category_id = c.id

    WHERE r.user_id = ${studentId}::uuid

    ORDER BY
      r.created_at DESC,
      r.id DESC
  `

  return rows.map((row) => ({
    id: row.registration_id,
    registeredAt:
      row.registration_created_at.toISOString(),
    event: mapEvent(row),
  }))
}

// ----------------------------------
// Eventbelegung und eigenen Status
// ----------------------------------

export async function findPublishedRegistrationSnapshot(
  eventId: string,
  studentId?: string,
): Promise<RegistrationSnapshot | null> {

  const rows = await sql<AvailabilityRow[]>`
    SELECT
      e.id,
      e.capacity,

      COUNT(r.id)::integer AS registered_count,

      COALESCE(
        BOOL_OR(
          r.user_id = ${studentId ?? null}::uuid
        ),
        FALSE
      ) AS is_registered,

      (e.starts_at > NOW()) AS starts_in_future

    FROM events e

    LEFT JOIN registrations r
      ON r.event_id = e.id

    WHERE e.id = ${eventId}::uuid
      AND e.status = 'published'

    GROUP BY
      e.id,
      e.capacity,
      e.starts_at
  `

  const row = rows[0]

  if (!row) {
    return null
  }

  return {
    eventId: row.id,
    capacity: row.capacity,
    registeredCount: row.registered_count,
    isRegistered: row.is_registered,
    startsInFuture: row.starts_in_future,
  }
}
