import { apiRequest } from '@/lib/api'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

export type UserRole = {
  role: {
    id: string
    name: string
  }
}

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  status: UserStatus
  lastLoginAt?: string | null
  createdAt: string
  userRoles: UserRole[]
}

export type Role = {
  id: string
  name: string
  description?: string | null
  isSystem: boolean
}

export type PaginatedUsers = {
  data: User[]
  total: number
  limit: number
  skip: number
}

export async function fetchUsers(params: {
  limit: number
  skip: number
  search?: string
  status?: UserStatus
  roleId?: string
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.roleId) query.set('roleId', params.roleId)
  return apiRequest<PaginatedUsers>(`/users?${query.toString()}`)
}

export async function fetchRoles() {
  return apiRequest<Role[]>('/users/roles')
}

export async function createUser(payload: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  status?: UserStatus
  roleIds?: string[]
}) {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(
  id: string,
  payload: {
    email?: string
    password?: string
    firstName?: string
    lastName?: string
    phone?: string
    status?: UserStatus
    roleIds?: string[]
  },
) {
  return apiRequest<User>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateUserStatus(id: string, status: UserStatus) {
  return apiRequest<User>(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function deleteUser(id: string) {
  return apiRequest<{ message: string }>(`/users/${id}`, {
    method: 'DELETE',
  })
}
