import { z } from 'zod'

export const registerSchema = z.strictObject({
  name: z.string()
    .trim()
    .min(2)
    .max(80),

  email: z.string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254)),

  password: z.string()
    .min(15)
    .max(128),
})

export const loginSchema = z.strictObject({
  email: z.string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254)),

  password: z.string().min(1).max(128),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>