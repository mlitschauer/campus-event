import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
} from '../src/services/authService'

vi.mock('../src/services/authService', () => ({
  getCurrentUser: vi.fn(),
  loginWithPassword: vi.fn(),
  logoutCurrentUser: vi.fn(),
  registerAccount: vi.fn(),
}))

const student = { id: 'student-1', name: 'Student', email: 'student@example.test', role: 'student' as const }
const otherStudent = { ...student, id: 'student-2' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function authenticated() {
  const { useAuth } = await import('../src/composables/useAuth')
  const auth = useAuth()
  vi.mocked(getCurrentUser).mockResolvedValue({ user: student })
  await auth.initializeAuth()
  return auth
}

describe('CE-31: Session-Abfragen bei Auth-Wechseln', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    vi.mocked(logoutCurrentUser).mockResolvedValue({ message: 'Abgemeldet' })
  })

  it('übernimmt nach bestätigtem Logout keinen verspäteten Benutzer', async () => {
    const auth = await authenticated()
    const pending = deferred<Awaited<ReturnType<typeof getCurrentUser>>>()
    vi.mocked(getCurrentUser).mockReturnValue(pending.promise)
    const refresh = auth.refreshAuth()
    await auth.logout()
    pending.resolve({ user: student })
    await refresh
    expect(auth.user.value).toBeNull()
    expect(auth.status.value).toBe('guest')
  })

  it.each(['success', 'error'])('ignoriert alte %s-Antwort nach neuem Login', async outcome => {
    const auth = await authenticated()
    const pending = deferred<Awaited<ReturnType<typeof getCurrentUser>>>()
    vi.mocked(getCurrentUser).mockReturnValue(pending.promise)
    const refresh = auth.refreshAuth()
    await auth.logout()
    vi.mocked(loginWithPassword).mockResolvedValue({ user: otherStudent })
    const login = auth.login({ email: otherStudent.email, password: 'test-only-password' })
    // Ein neuer Login darf nicht auf eine entwertete GET-Anfrage warten.
    await vi.waitFor(() => expect(loginWithPassword).toHaveBeenCalledTimes(1))
    await login
    if (outcome === 'success') pending.resolve({ user: student })
    else pending.reject(new Error('Alte Anfrage fehlgeschlagen'))
    await refresh
    expect(auth.user.value?.id).toBe(otherStudent.id)
    expect(auth.status.value).toBe('authenticated')
  })

  it('lässt eine neuere Session-Abfrage beim Abschluss der alten bestehen', async () => {
    const auth = await authenticated()
    const oldRequest = deferred<Awaited<ReturnType<typeof getCurrentUser>>>()
    const newRequest = deferred<Awaited<ReturnType<typeof getCurrentUser>>>()
    vi.mocked(getCurrentUser)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise)
    const oldRefresh = auth.refreshAuth()
    await auth.logout()
    const newRefresh = auth.refreshAuth()
    oldRequest.resolve({ user: student })
    await oldRefresh
    expect(auth.refreshAuth()).toBe(newRefresh)
    expect(getCurrentUser).toHaveBeenCalledTimes(3)
    newRequest.resolve({ user: otherStudent })
    await newRefresh
    expect(auth.user.value?.id).toBe(otherStudent.id)
  })

  it('bündelt parallele Session-Abfragen', async () => {
    const auth = await authenticated()
    const pending = deferred<Awaited<ReturnType<typeof getCurrentUser>>>()
    vi.mocked(getCurrentUser).mockReturnValue(pending.promise)
    const refresh = auth.refreshAuth()
    expect(auth.refreshAuth()).toBe(refresh)
    expect(getCurrentUser).toHaveBeenCalledTimes(2)
    pending.resolve({ user: student })
    await refresh
  })

  it('behält den Benutzer bei fehlgeschlagenem Logout', async () => {
    const auth = await authenticated()
    vi.mocked(logoutCurrentUser).mockRejectedValue(new Error('Netzwerkfehler'))
    await expect(auth.logout()).rejects.toThrow('Netzwerkfehler')
    expect(auth.user.value?.id).toBe(student.id)
    expect(auth.status.value).toBe('authenticated')
  })
})
