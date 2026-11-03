export type UserRole = 'student' | 'organizer'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthUserResponse {
  user: AuthUser
}

export interface LogoutResponse {
  message: string
}