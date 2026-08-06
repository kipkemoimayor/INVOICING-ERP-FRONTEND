import { apiRequest } from '@/lib/api'
import type { AuthSessionUser } from '@/lib/auth'

export async function login(payload: { email: string; password: string }) {
  return apiRequest<{ accessToken: string; user: AuthSessionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function me() {
  return apiRequest<AuthSessionUser>('/auth/me')
}

export async function logout() {
  return apiRequest<{ message: string }>('/auth/logout', {
    method: 'POST',
  })
}

export async function bootstrapAdmin(payload: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}) {
  return apiRequest<{ message: string; email: string; role: string }>('/auth/bootstrap-admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchBootstrapStatus() {
  return apiRequest<{ canBootstrapAdmin: boolean }>('/auth/bootstrap-status')
}
