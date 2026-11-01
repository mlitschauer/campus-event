export type EventStatus =
  | 'draft'
  | 'published'
  | 'cancelled'

export interface CampusEvent {
  id: string
  title: string
  description: string
  location: string

  startsAt: string
  endsAt: string

  capacity: number
  status: EventStatus

  organizer: {
    id: string
    name: string
  }

  category: {
    id: string
    name: string
    slug: string
  }
}