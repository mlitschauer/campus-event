import type { CampusEvent } from './event'

// Öffentliche Belegung einer Veranstaltung
export interface EventAvailability {
  eventId: string
  capacity: number
  registeredCount: number
  availableSeats: number
  isRegistrationOpen: boolean
}

// Persönlicher Status eines Studenten
export interface StudentRegistrationStatus
  extends EventAvailability {
  isRegistered: boolean
  canRegister: boolean
  canUnregister: boolean
}

// Eine einzelne Anmeldung
export interface Registration {
  id: string
  eventId: string
  userId: string
  createdAt: string
}

// Anmeldungen mit Veranstaltungsdaten
export interface MyRegistration {
  id: string
  registeredAt: string
  event: CampusEvent
}