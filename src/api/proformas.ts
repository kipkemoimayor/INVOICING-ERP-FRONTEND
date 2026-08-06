import { apiBlobRequest, apiRequest } from '@/lib/api'

export type ProformaStatus = 'PENDING' | 'APPROVED' | 'CANCELLED' | 'PAID'

export type Proforma = {
  id: string
  proformaNumber: string
  quotationId: string
  customerId: string
  status: ProformaStatus
  issueDate: string
  dueDate?: string | null
  currency: string
  totalAmount: string
  customer?: { id: string; companyName: string }
  quotation?: { id: string; quotationNumber: string }
}

export type PaginatedProformas = {
  data: Proforma[]
  total: number
  limit: number
  skip: number
}

export async function fetchProformas(params: {
  limit: number
  skip: number
  search?: string
  status?: ProformaStatus
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  return apiRequest<PaginatedProformas>(`/proformas?${query.toString()}`)
}

export async function updateProformaStatus(id: string, status: ProformaStatus) {
  return apiRequest<Proforma>(`/proformas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function convertProformaToInvoice(id: string) {
  return apiRequest(`/proformas/${id}/convert-to-invoice`, {
    method: 'POST',
  })
}

export async function deleteProforma(id: string) {
  return apiRequest<Proforma>(`/proformas/${id}`, {
    method: 'DELETE',
  })
}

export async function fetchProformaPdf(id: string) {
  return apiBlobRequest(`/proformas/${id}/pdf`)
}
