const encoder = new TextEncoder()

// Byte-Array als Hex-String darstellen
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// Kryptografisch zufälligen Session-Token erzeugen
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32),
  )

  return toHex(bytes)
}

// Session-Token mit SHA-256 hashen
export async function hashSessionToken(
  token: string,
): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(token),
  )

  return toHex(new Uint8Array(hash))
}

// Tokenformat überprüfen
export function isValidSessionToken(
  token: string,
): boolean {
  return /^[0-9a-f]{64}$/.test(token)
}