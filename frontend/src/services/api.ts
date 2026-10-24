const API_BASE_URL =
  (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `API-Fehler: ${response.status} ${response.statusText}`,
    )
  }

  return (await response.json()) as T
}