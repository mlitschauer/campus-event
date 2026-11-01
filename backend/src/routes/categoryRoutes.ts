import type { Hono } from 'hono'
import { getCategories } from '../services/categoryService.ts'

export function registerCategoryRoutes(app: Hono): void {

  // GET /api/categories
  app.get('/api/categories', async (c) => {
    const categories = await getCategories()

    return c.json(categories, 200)
  })
}