
import {
  findRegistrationsByStudent,
  findPublishedRegistrationSnapshot,
} from '../repositories/registrationReadRepository.ts'

import type {
  MyRegistration,
  RegistrationSnapshot,
} from '../repositories/registrationReadRepository.ts'

// Öffentliche Belegungsinformationen
export interface EventAvailability {
  eventId: string
  capacity: number
  registeredCount: number
  availableSeats: number
  isRegistrationOpen: boolean
}

// Persönlicher Anmeldestatus eines Studenten
export interface StudentRegistrationStatus
  extends EventAvailability {
  isRegistered: boolean
  canRegister: boolean
  canUnregister: boolean
}

// ----------------------------------
// Eigene Anmeldungen
// ----------------------------------

export function getMyRegistrations(
  studentId: string,
): Promise<MyRegistration[]> {
  return findRegistrationsByStudent(studentId)
}

// ----------------------------------
// Gemeinsame Berechnung freier Plätze
// ----------------------------------

function calculateAvailability(
  snapshot: RegistrationSnapshot,
): EventAvailability {

  const availableSeats = Math.max(
    0,
    snapshot.capacity - snapshot.registeredCount,
  )

  return {
    eventId: snapshot.eventId,
    capacity: snapshot.capacity,
    registeredCount: snapshot.registeredCount,
    availableSeats,

    isRegistrationOpen:
      snapshot.startsInFuture && availableSeats > 0,
  }
}

// ----------------------------------
// Öffentliche Belegung
// ----------------------------------

export async function getEventAvailability(
  eventId: string,
): Promise<EventAvailability | null> {

  const snapshot =
    await findPublishedRegistrationSnapshot(eventId)

  if (!snapshot) {
    return null
  }

  return calculateAvailability(snapshot)
}

// ----------------------------------
// Persönlicher Anmeldestatus
// ----------------------------------

export async function getStudentRegistrationStatus(
  eventId: string,
  studentId: string,
): Promise<StudentRegistrationStatus | null> {

  const snapshot =
    await findPublishedRegistrationSnapshot(
      eventId,
      studentId,
    )

  if (!snapshot) {
    return null
  }

  const availability = calculateAvailability(snapshot)

  return {
    ...availability,

    isRegistered: snapshot.isRegistered,

    // Eine neue Anmeldung ist nur bei freien
    // Plätzen und ohne bestehende Anmeldung möglich.
    canRegister:
      availability.isRegistrationOpen &&
      !snapshot.isRegistered,

    // Eigene Anmeldung kann bis zum
    // Veranstaltungsbeginn zurückgezogen werden.
    canUnregister:
      snapshot.isRegistered &&
      snapshot.startsInFuture,
  }
}
