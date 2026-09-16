import { apiBlobRequest, apiRequest } from '@/lib/api'

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'

export type QuotationItemPayload = {
  productId?: string
  quantity?: number
  unitPrice?: number
  description?: string
}

export type QuotationPayload = {
  customerId: string
  issueDate?: string
  expiryDate?: string
  currency?: string
  notes?: string
  status?: QuotationStatus
  items: QuotationItemPayload[]
}

export type Quotation = {
  id: string
  quotationNumber: string
  customerId: string
  status: QuotationStatus
  issueDate: string
  expiryDate?: string | null
  currency: string
  totalAmount: string
  invoiceId?: string | null
  convertedToInvoice?: boolean
  customer?: { id: string; companyName: string }
}

export type QuotationDetail = Quotation & {
  notes?: string | null
  items: Array<QuotationItemPayload & { id?: string }>
}

export type PaginatedQuotations = {
  data: Quotation[]
  total: number
  limit: number
  skip: number
}

export async function fetchQuotations(params: {
  limit: number
  skip: number
  search?: string
  status?: QuotationStatus
  customerId?: string
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.customerId) query.set('customerId', params.customerId)
  return apiRequest<PaginatedQuotations>(`/quotations?${query.toString()}`)
}

export async function createQuotation(payload: QuotationPayload) {
  return apiRequest<Quotation>('/quotations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchQuotationById(id: string) {
  return apiRequest<QuotationDetail>(`/quotations/${id}`)
}

export async function updateQuotation(id: string, payload: QuotationPayload) {
  return apiRequest<Quotation>(`/quotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateQuotationStatus(id: string, status: QuotationStatus) {
  return apiRequest<Quotation>(`/quotations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function deleteQuotation(id: string) {
  return apiRequest<Quotation>(`/quotations/${id}`, {
    method: 'DELETE',
  })
}

export async function convertQuotationToProforma(id: string) {
  return apiRequest(`/quotations/${id}/convert-to-proforma`, {
    method: 'POST',
  })
}

export async function convertQuotationToInvoice(id: string) {
  return apiRequest(`/quotations/${id}/convert-to-invoice`, {
    method: 'POST',
  })
}

export async function resendQuotationEmail(id: string) {
  return apiRequest<{ message: string }>(`/quotations/${id}/resend-email`, {
    method: 'POST',
  })
}

export async function fetchQuotationPdf(id: string) {
  return apiBlobRequest(`/quotations/${id}/pdf`)
}
