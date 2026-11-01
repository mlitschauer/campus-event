import {
  findPublishedEvents,
  findPublishedEventById,
} from '../repositories/eventRepository.ts'

import type { CampusEvent } from '../types/event.ts'

// Alle veröffentlichten Events laden
export async function getPublishedEvents(): Promise<CampusEvent[]> {
  return await findPublishedEvents()
}

// Ein veröffentlichtes Event anhand der ID laden
export async function getPublishedEventById(
  id: string,
): Promise<CampusEvent | null> {
  return await findPublishedEventById(id)
}