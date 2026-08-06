import { apiRequest } from '@/lib/api'

export type Permission = {
  id: string
  code: string
  name: string
  description?: string | null
}

export type Role = {
  id: string
  name: string
  description?: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
  permissions: Permission[]
  _count: {
    userRoles: number
  }
}

export type PaginatedRoles = {
  data: Role[]
  total: number
  limit: number
  skip: number
}

export async function fetchRoles(params: {
  limit: number
  skip: number
  search?: string
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  return apiRequest<PaginatedRoles>(`/roles?${query.toString()}`)
}

export async function fetchPermissions(search?: string) {
  const query = new URLSearchParams()
  if (search) query.set('search', search)
  return apiRequest<Permission[]>(`/roles/permissions?${query.toString()}`)
}

export async function createRole(payload: {
  name: string
  description?: string
  permissionIds?: string[]
}) {
  return apiRequest<Role>('/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRole(
  id: string,
  payload: {
    name?: string
    description?: string
    permissionIds?: string[]
  },
) {
  return apiRequest<Role>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteRole(id: string) {
  return apiRequest<{ message: string }>(`/roles/${id}`, {
    method: 'DELETE',
  })
}
