import {
  getJson,
  postJson,
  deleteNoContent,
} from './api'

import type {
  CampusEvent,
} from '../types/event'

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