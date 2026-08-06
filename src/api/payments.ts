import { apiBlobRequest, apiRequest } from '@/lib/api'

export type PaymentMethod = 'CASH' | 'BANK' | 'CHEQUE' | 'MOBILE_MONEY' | 'CARD'

export type Payment = {
  id: string
  paymentNumber: string
  customerId: string
  invoiceId?: string | null
  proformaId?: string | null
  method: PaymentMethod
  amount: string
  reference?: string | null
  paidAt: string
  notes?: string | null
  receiptPath?: string | null
  customer?: { id: string; companyName: string }
  invoice?: {
    id: string
    invoiceNumber: string
    taxAmount: string
    totalAmount: string
    currency: string
  } | null
  proforma?: {
    id: string
    proformaNumber: string
    taxAmount: string
    totalAmount: string
    currency: string
  } | null
}

export type PaginatedPayments = {
  data: Payment[]
  total: number
  limit: number
  skip: number
}

export type PaymentStatement = {
  fromDate: string
  toDate: string
  customerId?: string | null
  count: number
  totals: {
    grossTotal: number
    taxTotal: number
    netTotal: number
  }
  data: Payment[]
}

export async function fetchPayments(params: {
  limit: number
  skip: number
  search?: string
  method?: PaymentMethod
  invoiceId?: string
  proformaId?: string
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.method) query.set('method', params.method)
  if (params.invoiceId) query.set('invoiceId', params.invoiceId)
  if (params.proformaId) query.set('proformaId', params.proformaId)
  return apiRequest<PaginatedPayments>(`/payments?${query.toString()}`)
}

export async function createPayment(payload: {
  invoiceId?: string
  proformaId?: string
  amount: number
  method: PaymentMethod
  reference?: string
  paidAt?: string
  notes?: string
  proof?: File
}) {
  const formData = new FormData()
  if (payload.invoiceId) formData.append('invoiceId', payload.invoiceId)
  if (payload.proformaId) formData.append('proformaId', payload.proformaId)
  formData.append('amount', String(payload.amount))
  formData.append('method', payload.method)
  if (payload.reference) formData.append('reference', payload.reference)
  if (payload.paidAt) formData.append('paidAt', payload.paidAt)
  if (payload.notes) formData.append('notes', payload.notes)
  if (payload.proof) formData.append('proof', payload.proof)
  return apiRequest<Payment>('/payments', {
    method: 'POST',
    body: formData,
  })
}

export async function fetchPaymentProof(paymentId: string) {
  return apiBlobRequest(`/payments/${paymentId}/proof`)
}

export async function reversePayment(id: string) {
  return apiRequest<{ message: string }>(`/payments/${id}`, {
    method: 'DELETE',
  })
}

export async function fetchPaymentStatement(params: {
  fromDate: string
  toDate: string
  customerId?: string
}) {
  const query = new URLSearchParams({
    fromDate: params.fromDate,
    toDate: params.toDate,
  })
  if (params.customerId) query.set('customerId', params.customerId)
  return apiRequest<PaymentStatement>(`/payments/statement?${query.toString()}`)
}

export async function exportPaymentsExcel(params: {
  search?: string
  method?: PaymentMethod
}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.method) query.set('method', params.method)
  return apiBlobRequest(`/payments/export?${query.toString()}`)
}
