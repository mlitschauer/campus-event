import { getJson, postJson } from './api'

import type {
  AuthUserResponse,
  RegisterInput,
  LoginInput,
  LogoutResponse,
} from '../types/auth'

// POST /api/auth/register
export function registerAccount(
  input: RegisterInput,
): Promise<AuthUserResponse> {
  return postJson<AuthUserResponse>(
    '/api/auth/register',
    input,
  )
}

// POST /api/auth/login
export function loginWithPassword(
  input: LoginInput,
): Promise<AuthUserResponse> {
  return postJson<AuthUserResponse>(
    '/api/auth/login',
    input,
  )
}

// GET /api/auth/me
export function getCurrentUser(): Promise<AuthUserResponse> {
  return getJson<AuthUserResponse>('/api/auth/me')
}

// POST /api/auth/logout
export function logoutCurrentUser(): Promise<LogoutResponse> {
  return postJson<LogoutResponse>('/api/auth/logout')
}