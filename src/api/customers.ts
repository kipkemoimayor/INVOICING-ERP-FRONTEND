import { apiRequest } from '@/lib/api'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export type Customer = {
  id: string
  customerCode: string
  companyName: string
  contactPerson?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  taxNumber?: string | null
  status: CustomerStatus
  creditLimit?: string | null
  createdAt: string
}

export type PaginatedCustomers = {
  data: Customer[]
  total: number
  limit: number
  skip: number
}

export type UpsertCustomerPayload = {
  companyName: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  taxNumber?: string
  status?: CustomerStatus
}

export async function fetchCustomers(params: {
  limit: number
  skip: number
  search?: string
  status?: CustomerStatus
}): Promise<PaginatedCustomers> {
  const query = new URLSearchParams({
    limit: params.limit.toString(),
    skip: params.skip.toString(),
  })

  if (params.search) {
    query.set('search', params.search)
  }

  if (params.status) {
    query.set('status', params.status)
  }

  return apiRequest<PaginatedCustomers>(`/customers?${query.toString()}`)
}

export async function createCustomer(payload: UpsertCustomerPayload) {
  return apiRequest<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCustomer(id: string, payload: UpsertCustomerPayload) {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteCustomer(id: string) {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: 'DELETE',
  })
}
