import {
  categoryExists,
  findOwnedEventById,
  insertDraftEvent,
  updateDraftEvent,
  deleteDraftEvent,
  publishDraftEvent,
  cancelPublishedEvent,
} from '../repositories/eventManagementRepository.ts'

import type {
  ManagedEvent,
} from '../repositories/eventManagementRepository.ts'

import type {
  CreateEventInput,
  UpdateEventInput,
} from '../schemas/eventManagementSchema.ts'

// Gemeinsame Ergebnisstruktur
export type EventMutationResult =
  | { kind: 'success'; event: ManagedEvent }
  | { kind: 'not-found' }
  | { kind: 'invalid-category' }
  | { kind: 'invalid-dates' }
  | { kind: 'conflict' }

export type EventStatusResult =
  | { kind: 'success'; event: ManagedEvent }
  | { kind: 'not-found' }
  | { kind: 'invalid-status' }
  | { kind: 'event-started' }
  | { kind: 'conflict' }

// Entwurf erstellen
export async function createManagedEvent(
  organizerId: string,
  input: CreateEventInput,
): Promise<EventMutationResult> {
  const eventId = await insertDraftEvent(
    organizerId,
    input,
  )

  // INSERT ... SELECT erzeugt keine Zeile,
  // wenn die Kategorie nicht existiert.
  if (!eventId) {
    return { kind: 'invalid-category' }
  }

  const event = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!event) {
    throw new Error(
      'Neu erstelltes Event konnte nicht geladen werden.',
    )
  }

  return {
    kind: 'success',
    event,
  }
}

// Eigenen Entwurf bearbeiten
export async function updateManagedEvent(
  eventId: string,
  organizerId: string,
  input: UpdateEventInput,
): Promise<EventMutationResult> {
  // Eigentümerprüfung
  const existing = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!existing) {
    return { kind: 'not-found' }
  }

  // Bereits veröffentlichte oder stornierte
  // Events werden in CE-20 nicht geändert.
  if (existing.status !== 'draft') {
    return { kind: 'conflict' }
  }

  // Neue Kategorie prüfen
  if (
    input.categoryId &&
    !(await categoryExists(input.categoryId))
  ) {
    return { kind: 'invalid-category' }
  }

  // Bei PATCH nicht übertragene Zeitpunkte
  // vom bisherigen Event übernehmen.
  const startsAt =
    input.startsAt ?? existing.startsAt

  const endsAt =
    input.endsAt ?? existing.endsAt

  if (
    new Date(endsAt).getTime() <=
    new Date(startsAt).getTime()
  ) {
    return { kind: 'invalid-dates' }
  }

  // UPDATE enthält die Eigentümerprüfung
  // zusätzlich direkt in der SQL-Abfrage.
  const updated = await updateDraftEvent(
    eventId,
    organizerId,
    input,
  )

  if (!updated) {
    return { kind: 'conflict' }
  }

  const event = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!event) {
    return { kind: 'not-found' }
  }

  return {
    kind: 'success',
    event,
  }
}

// Eigenen Entwurf löschen
export async function removeManagedEvent(
  eventId: string,
  organizerId: string,
): Promise<
  { kind: 'deleted' | 'not-found' | 'conflict' }
> {
  const existing = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!existing) {
    return { kind: 'not-found' }
  }

  if (existing.status !== 'draft') {
    return { kind: 'conflict' }
  }

  const deleted = await deleteDraftEvent(
    eventId,
    organizerId,
  )

  if (!deleted) {
    return { kind: 'conflict' }
  }

  return { kind: 'deleted' }
}

// Eigenen Entwurf veröffentlichen
export async function publishManagedEvent(
  eventId: string,
  organizerId: string,
): Promise<EventStatusResult> {

  // Veranstaltung mit Eigentümerprüfung laden
  const existing = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!existing) {
    return { kind: 'not-found' }
  }

  // Nur Entwürfe dürfen veröffentlicht werden
  if (existing.status !== 'draft') {
    return { kind: 'invalid-status' }
  }

  // Veranstaltungsbeginn muss in der Zukunft liegen
  if (
    new Date(existing.startsAt).getTime() <= Date.now()
  ) {
    return { kind: 'event-started' }
  }

  // Atomare Statusänderung mit erneuter
  // Eigentümer- und Statusprüfung in PostgreSQL
  const published = await publishDraftEvent(
    eventId,
    organizerId,
  )

  if (!published) {
    return { kind: 'conflict' }
  }

  // Aktualisierte Veranstaltung abrufen
  const event = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!event) {
    throw new Error(
      'Veröffentlichtes Event konnte nicht geladen werden.',
    )
  }

  return {
    kind: 'success',
    event,
  }
}

// Eigene veröffentlichte Veranstaltung absagen
export async function cancelManagedEvent(
  eventId: string,
  organizerId: string,
): Promise<EventStatusResult> {

  // Veranstaltung mit Eigentümerprüfung laden
  const existing = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!existing) {
    return { kind: 'not-found' }
  }

  // Nur veröffentlichte Events dürfen abgesagt werden
  if (existing.status !== 'published') {
    return { kind: 'invalid-status' }
  }

  // Atomare Statusänderung
  const cancelled = await cancelPublishedEvent(
    eventId,
    organizerId,
  )

  if (!cancelled) {
    return { kind: 'conflict' }
  }

  // Aktualisierte Veranstaltung abrufen
  const event = await findOwnedEventById(
    eventId,
    organizerId,
  )

  if (!event) {
    throw new Error(
      'Abgesagtes Event konnte nicht geladen werden.',
    )
  }

  return {
    kind: 'success',
    event,
  }
}