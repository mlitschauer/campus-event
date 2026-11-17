import {
  getJson,
  postJson,
  patchJson,
  deleteNoContent,
} from './api'

import type {
  CampusEvent,
} from '../types/event'

import type {
  EventFormInput,
  EventFormCategory,
} from '../types/eventManagement'

interface EventListResponse {
  events: CampusEvent[]
}

interface EventResponse {
  event: CampusEvent
}

// Alle eigenen Veranstaltungen laden
export async function getOrganizerEvents():
  Promise<CampusEvent[]> {
  const response = await getJson<EventListResponse>(
    '/api/organizer/events',
  )

  return response.events
}

// Eigenen Entwurf veröffentlichen
export async function publishOrganizerEvent(
  id: string,
): Promise<CampusEvent> {
  const response = await postJson<EventResponse>(
    `/api/events/${encodeURIComponent(id)}/publish`,
  )

  return response.event
}

// Eigene veröffentlichte Veranstaltung absagen
export async function cancelOrganizerEvent(
  id: string,
): Promise<CampusEvent> {
  const response = await postJson<EventResponse>(
    `/api/events/${encodeURIComponent(id)}/cancel`,
  )

  return response.event
}

// Eigenen Entwurf löschen
export function deleteOrganizerEvent(
  id: string,
): Promise<void> {
  return deleteNoContent(
    `/api/events/${encodeURIComponent(id)}`,
  )
}

// Eigenes Event für das Bearbeitungsformular abrufen
export async function getOrganizerEventById(
  id: string,
): Promise<CampusEvent> {
  const response = await getJson<EventResponse>(
    `/api/organizer/events/${encodeURIComponent(id)}`,
  )

  return response.event
}

// Kategorien für das Eventformular laden
export async function getEventFormCategories():
  Promise<EventFormCategory[]> {

  type CategoryResponse =
    | EventFormCategory[]
    | { categories: EventFormCategory[] }

  const response = await getJson<CategoryResponse>(
    '/api/categories',
  )

  // Unterstützt die bisherige Array-Antwort
  // ebenso wie eine Antwort mit { categories: [...] }.
  return Array.isArray(response)
    ? response
    : response.categories
}

// Neues Event als Entwurf erstellen
export async function createOrganizerEvent(
  input: EventFormInput,
): Promise<CampusEvent> {
  const response = await postJson<EventResponse>(
    '/api/events',
    input,
  )

  return response.event
}

// Eigenen Entwurf bearbeiten
export async function updateOrganizerEvent(
  id: string,
  input: EventFormInput,
): Promise<CampusEvent> {
  const response = await patchJson<EventResponse>(
    `/api/events/${encodeURIComponent(id)}`,
    input,
  )

  return response.event
}