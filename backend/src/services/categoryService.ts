import { findAllCategories } from '../repositories/categoryRepository.ts'
import type { Category } from '../types/category.ts'

// Alle Kategorien laden
export async function getCategories(): Promise<Category[]> {
  return await findAllCategories()
}