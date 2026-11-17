
const API_BASE_URL =
  (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export interface ApiErrorDetail {
  field: string
  message: string
}

interface ApiErrorResponse {
  error?: {
    code?: string
    message?: string
    details?: ApiErrorDetail[]
  }
}

export class ApiError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details: ApiErrorDetail[]

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
  ) {
    super(message)

    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// Gemeinsame HTTP- und JSON-Verarbeitung
async function requestJson<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Die Verbindung zum Server konnte nicht hergestellt werden.',
    )
  }

  // HTTP-Fehler behandeln
  if (!response.ok) {
    let errorData: ApiErrorResponse | null = null

    try {
      errorData = (await response.json()) as ApiErrorResponse
    } catch {
      // Keine gültige JSON-Fehlerantwort
    }

    throw new ApiError(
      response.status,
      errorData?.error?.code ?? `HTTP_${response.status}`,
      errorData?.error?.message ??
        `API-Anfrage fehlgeschlagen (HTTP ${response.status}).`,
      errorData?.error?.details ?? [],
    )
  }

  // HTTP 204 enthält absichtlich keinen JSON-Body.
if (response.status === 204) {
  return undefined as T
}

  // Erfolgreiche JSON-Antwort verarbeiten
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'Die Serverantwort enthält kein gültiges JSON.',
    )
  }
}

// GET-Anfragen
export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, 'GET')
}

// POST-Anfragen
export function postJson<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return requestJson<T>(path, 'POST', body)
}

// DELETE-Anfragen ohne erwarteten Response-Body
export function deleteNoContent(
  path: string,
): Promise<void> {
  return requestJson<void>(path, 'DELETE')
}

// PATCH-Anfragen mit JSON-Body
export function patchJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return requestJson<T>(
    path,
    'PATCH',
    body,
  )
}