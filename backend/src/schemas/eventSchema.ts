import { z } from 'zod'

// Validierung für die Eventübersicht
export const eventQuerySchema = z.strictObject({
  category: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),

  search: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
})

// Validierung für einzelne Event-IDs
export const eventIdSchema = z.uuid()