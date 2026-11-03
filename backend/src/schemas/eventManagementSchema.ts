import { z } from 'zod'

// Zeitangaben müssen eine Zeitzone enthalten,
// z. B. 2026-12-10T18:00:00+01:00
const eventDateTime = z.iso.datetime({
  offset: true,
})

const eventFields = {
  title: z.string().trim().min(3).max(120),

  description: z.string().trim().min(10).max(5000),

  location: z.string().trim().min(3).max(200),

  startsAt: eventDateTime,

  endsAt: eventDateTime,

  capacity: z.number().int().min(1).max(10000),

  categoryId: z.uuid(),
}

// Event erstellen: alle Angaben erforderlich
export const createEventSchema = z
  .strictObject(eventFields)
  .refine(
    (data) =>
      new Date(data.endsAt).getTime() >
      new Date(data.startsAt).getTime(),
    {
      message: 'Das Ende muss nach dem Beginn liegen.',
      path: ['endsAt'],
    },
  )

// Event bearbeiten: mindestens ein Feld erforderlich
export const updateEventSchema = z
  .strictObject(eventFields)
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'Mindestens ein Feld muss geändert werden.',
    },
  )

export type CreateEventInput =
  z.infer<typeof createEventSchema>

export type UpdateEventInput =
  z.infer<typeof updateEventSchema>