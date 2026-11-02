import { getJson } from './api'
import type { Category } from '../types/category'

// Alle Kategorien abrufen
export function getCategories(): Promise<Category[]> {
  return getJson<Category[]>('/api/categories')
}