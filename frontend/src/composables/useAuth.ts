import {
  computed,
  readonly,
  ref,
  shallowRef,
} from 'vue'

import {
  getCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
  registerAccount,
} from '../services/authService'

import { ApiError } from '../services/api'

import type {
  AuthUser,
  LoginInput,
  RegisterInput,
} from '../types/auth'

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'guest'
  | 'error'

// Gemeinsamer Zustand für die gesamte Anwendung
const user = shallowRef<AuthUser | null>(null)
const status = ref<AuthStatus>('idle')

const isAuthenticated = computed(() => user.value !== null)

// Verhindert doppelte gleichzeitige Session-Abfragen
let sessionRequest: Promise<void> | null = null

// Session anhand des HttpOnly-Cookies überprüfen
function refreshAuth(): Promise<void> {
  if (sessionRequest) {
    return sessionRequest
  }

  status.value = 'loading'

  sessionRequest = (async () => {
    try {
      const response = await getCurrentUser()

      user.value = response.user
      status.value = 'authenticated'

    } catch (error) {
      user.value = null

      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        // Benutzer ist regulär nicht angemeldet
        status.value = 'guest'
      } else {
        // Netzwerk- oder Serverproblem
        status.value = 'error'
      }
    }
  })().finally(() => {
    sessionRequest = null
  })

  return sessionRequest
}

// Nur beim ersten Start oder nach einem Fehler prüfen
function initializeAuth(): Promise<void> {
  if (sessionRequest) {
    return sessionRequest
  }

  if (
    status.value !== 'idle' &&
    status.value !== 'error'
  ) {
    return Promise.resolve()
  }

  return refreshAuth()
}

// Registrierung
async function register(
  input: RegisterInput,
): Promise<AuthUser> {
  const response = await registerAccount(input)

  // Registrierung erzeugt noch keine Session
  return response.user
}

// Login
async function login(
  input: LoginInput,
): Promise<AuthUser> {
  await initializeAuth()

  const response = await loginWithPassword(input)

  user.value = response.user
  status.value = 'authenticated'

  return response.user
}

// Logout
async function logout(): Promise<void> {
  await logoutCurrentUser()

  // Erst nach bestätigtem serverseitigem Logout
  // den lokalen Benutzerzustand zurücksetzen.
  user.value = null
  status.value = 'guest'
}

// Öffentliche Schnittstelle des Composables
export function useAuth() {
  return {
    user: readonly(user),
    status: readonly(status),
    isAuthenticated,

    initializeAuth,
    refreshAuth,

    register,
    login,
    logout,
  }
}