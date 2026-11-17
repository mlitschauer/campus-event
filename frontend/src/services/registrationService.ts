import {
  getJson,
  postJson,
  deleteNoContent,
} from './api'

import type {
  EventAvailability,
  StudentRegistrationStatus,
  Registration,
  MyRegistration,
} from '../types/registration'

// ----------------------------------
// Öffentliche Belegungsinformationen
// ----------------------------------
export async function getEventAvailability(
  eventId: string,
): Promise<EventAvailability> {
  const response = await getJson<{
    availability: EventAvailability
  }>(
    `/api/events/${encodeURIComponent(eventId)}/availability`,
  )

  return response.availability
}

// ----------------------------------
// Persönlichen Anmeldestatus laden
// ----------------------------------
export async function getRegistrationStatus(
  eventId: string,
): Promise<StudentRegistrationStatus> {
  const response = await getJson<{
    registrationStatus: StudentRegistrationStatus
  }>(
    `/api/events/${encodeURIComponent(eventId)}/registration-status`,
  )

  return response.registrationStatus
}

// ----------------------------------
// Eigene Anmeldungen abrufen
// ----------------------------------
export async function getMyRegistrations():
  Promise<MyRegistration[]> {
  const response = await getJson<{
    registrations: MyRegistration[]
  }>('/api/me/registrations')

  return response.registrations
}

// ----------------------------------
// Für Veranstaltung anmelden
// ----------------------------------
export async function registerForEvent(
  eventId: string,
): Promise<Registration> {
  const response = await postJson<{
    registration: Registration
  }>(
    `/api/events/${encodeURIComponent(eventId)}/registrations`,
  )

  return response.registration
}

// ----------------------------------
// Anmeldung zurückziehen
// ----------------------------------
export function unregisterFromEvent(
  eventId: string,
): Promise<void> {
  return deleteNoContent(
    `/api/events/${encodeURIComponent(eventId)}/registrations/me`,
  )
}