const MAX_FAILURES = 8
const WINDOW_MS = 15 * 60 * 1000
const MAX_ENTRIES = 5000

interface FailedLogin {
  count: number
  expiresAt: number
}

const failedLogins = new Map<string, FailedLogin>()

// Restliche Sperrzeit in Sekunden
export function getLoginRetryAfter(email: string): number {
  const entry = failedLogins.get(email)

  if (!entry) return 0

  const remaining = entry.expiresAt - Date.now()

  if (remaining <= 0) {
    failedLogins.delete(email)
    return 0
  }

  return entry.count >= MAX_FAILURES
    ? Math.ceil(remaining / 1000)
    : 0
}

// Fehlversuch registrieren
export function recordFailedLogin(email: string): void {
  const now = Date.now()
  const current = failedLogins.get(email)

  if (current && current.expiresAt > now) {
    current.count++
    return
  }

  // Begrenzung des Speicherverbrauchs
  if (failedLogins.size >= MAX_ENTRIES) {
    for (const [key, entry] of failedLogins) {
      if (entry.expiresAt <= now) {
        failedLogins.delete(key)
      }
    }

    if (failedLogins.size >= MAX_ENTRIES) {
      const firstKey = failedLogins.keys().next().value

      if (firstKey !== undefined) {
        failedLogins.delete(firstKey)
      }
    }
  }

  failedLogins.set(email, {
    count: 1,
    expiresAt: now + WINDOW_MS,
  })
}

// Nach erfolgreichem Login zurücksetzen
export function clearFailedLogins(email: string): void {
  failedLogins.delete(email)
}