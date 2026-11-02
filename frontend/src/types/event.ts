export type EventStatus =
  | 'draft'
  | 'published'
  | 'cancelled'

export interface EventOrganizer {
  id: string
  name: string
}

export interface EventCategory {
  id: string
  name: string
  slug: string
}

export interface CampusEvent {
  id: string
  title: string
  description: string
  location: string

  startsAt: string
  endsAt: string

  capacity: number
  status: EventStatus

  organizer: EventOrganizer
  category: EventCategory
}

export interface EventFilters {
  category?: string
  search?: string
}