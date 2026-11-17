import {
  insertRegistration,
  deleteOwnRegistration,
} from '../repositories/registrationRepository.ts'

import type {
  RegisterResult,
  UnregisterResult,
} from '../repositories/registrationRepository.ts'

// Student für ein Event anmelden
export function registerForEvent(
  eventId: string,
  studentId: string,
): Promise<RegisterResult> {
  return insertRegistration(eventId, studentId)
}

// Eigene Eventanmeldung zurückziehen
export function unregisterFromEvent(
  eventId: string,
  studentId: string,
): Promise<UnregisterResult> {
  return deleteOwnRegistration(eventId, studentId)
}