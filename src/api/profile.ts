import { apiRequest } from '@/lib/api'

export type Profile = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  status: string
  lastLoginAt?: string | null
  createdAt: string
  roles: string[]
  permissions: string[]
}

export async function fetchProfile() {
  return apiRequest<Profile>('/profile')
}

export async function updateProfile(payload: {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
}) {
  return apiRequest<Profile>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function changePassword(payload: {
  currentPassword: string
  newPassword: string
}) {
  return apiRequest<{ message: string }>('/profile/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
