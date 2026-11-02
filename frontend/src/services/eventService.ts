import { getJson } from './api'

import type {
  CampusEvent,
  EventFilters,
} from '../types/event'

// Alle veröffentlichten Events abrufen
export function getEvents(
  filters: EventFilters = {},
): Promise<CampusEvent[]> {

  const params = new URLSearchParams()

  if (filters.category?.trim()) {
    params.set('category', filters.category.trim())
  }

  if (filters.search?.trim()) {
    params.set('search', filters.search.trim())
  }

  const query = params.toString()

  const path = query
    ? `/api/events?${query}`
    : '/api/events'

  return getJson<CampusEvent[]>(path)
}

// Einzelnes Event anhand der UUID abrufen
export function getEventById(
  id: string,
): Promise<CampusEvent> {
  return getJson<CampusEvent>(
    `/api/events/${encodeURIComponent(id)}`
  )
}