import {
  findPublishedEvents,
  findPublishedEventById,
} from '../repositories/eventRepository.ts'

import type {
  CampusEvent,
  EventFilters,
} from '../types/event.ts'

export async function getPublishedEvents(
  filters: EventFilters = {},
): Promise<CampusEvent[]> {
  return await findPublishedEvents(filters)
}

export async function getPublishedEventById(
  id: string,
): Promise<CampusEvent | null> {
  return await findPublishedEventById(id)
}