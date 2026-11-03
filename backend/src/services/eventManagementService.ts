import {
  categoryExists,
  findOwnedEventById,
  insertDraftEvent,
  updateDraftEvent,
  deleteDraftEvent,
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