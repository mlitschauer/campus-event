import { timingSafeEqual } from 'node:crypto'

// Argon2id-Konfiguration nach OWASP-Mindestempfehlung
const MEMORY_KIB = 19_456
const PASSES = 2
const PARALLELISM = 1
const SALT_LENGTH = 16
const HASH_BITS = 256

const encoder = new TextEncoder()

// Binärdaten in Base64 ohne Padding umwandeln
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
}

// Base64 wieder in Binärdaten umwandeln
function fromBase64(value: string): Uint8Array {
  const padded = value.padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  )

  const binary = atob(padded)

  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  )
}

// Passwort mit Argon2id ableiten
async function derivePassword(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw-secret',
    encoder.encode(password),
    'Argon2id',
    false,
    ['deriveBits'],
  )

  // Argon2id-Parameter separat definieren
  const argon2Params = {
    name: 'Argon2id',
    memory: MEMORY_KIB,
    passes: PASSES,
    parallelism: PARALLELISM,
    nonce: salt,
  }

  const bits = await crypto.subtle.deriveBits(
    argon2Params,
    key,
    HASH_BITS,
  )

  return new Uint8Array(bits)
}

// Neuen Passwort-Hash erzeugen
export async function hashPassword(
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(
    new Uint8Array(SALT_LENGTH),
  )

  const hash = await derivePassword(password, salt)

  // PHC-Format: Algorithmus, Parameter, Salt und Hash
  return [
    '$argon2id',
    'v=19',
    `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}`,
    toBase64(salt),
    toBase64(hash),
  ].join('$')
}

// Passwort gegen gespeicherten Hash prüfen
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const match = storedHash.match(
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/,
  )

  if (!match) {
    return false
  }

  const [, memory, passes, parallelism, saltBase64, hashBase64] =
    match

  // Nur unsere unterstützte Hash-Konfiguration akzeptieren
  if (
    Number(memory) !== MEMORY_KIB ||
    Number(passes) !== PASSES ||
    Number(parallelism) !== PARALLELISM
  ) {
    return false
  }

  try {
    const salt = fromBase64(saltBase64)
    const expectedHash = fromBase64(hashBase64)

    if (
      salt.length !== SALT_LENGTH ||
      expectedHash.length !== HASH_BITS / 8
    ) {
      return false
    }

    const actualHash = await derivePassword(password, salt)

    return timingSafeEqual(actualHash, expectedHash)
  } catch {
    return false
  }
}