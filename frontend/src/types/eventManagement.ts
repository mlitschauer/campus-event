export interface EventFormInput {
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  capacity: number
  categoryId: string
}

export interface EventFormCategory {
  id: string
  name: string
}