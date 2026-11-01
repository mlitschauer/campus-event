import { sql } from '../db/client.ts'
import type { Category } from '../types/category.ts'

export async function findAllCategories(): Promise<Category[]> {
  const rows = await sql<Category[]>`
    SELECT
      id,
      name,
      slug
    FROM categories
    ORDER BY name ASC
  `

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }))
}