import { getJson } from './api'
import type { HealthResponse } from '../types/api'

export function getApiHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>('/api/health')
}