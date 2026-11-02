// Basisadresse der API
const API_BASE_URL =
  (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

// Struktur einer Fehlerantwort aus dem Backend
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

// Eigener Fehlertyp für API-Anfragen
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

// Zentrale Funktion zum Abrufen von JSON-Daten
export async function getJson<T>(path: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
  } catch {
    // Netzwerkfehler, z. B. fehlende Verbindung
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Die Verbindung zum Server konnte nicht hergestellt werden.',
    )
  }

  // HTTP-Status überprüfen
  if (!response.ok) {
    let errorData: ApiErrorResponse | null = null

    try {
      errorData = (await response.json()) as ApiErrorResponse
    } catch {
      // Server hat kein gültiges JSON zurückgegeben
    }

    throw new ApiError(
      response.status,
      errorData?.error?.code ?? `HTTP_${response.status}`,
      errorData?.error?.message ??
        `API-Anfrage fehlgeschlagen (HTTP ${response.status}).`,
      errorData?.error?.details ?? [],
    )
  }

  // Erfolgreiche JSON-Antwort auswerten
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