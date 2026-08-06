import { apiBlobRequest, apiRequest } from '@/lib/api'

export type InvoiceStatus = 'DRAFT' | 'APPROVED' | 'VOIDED' | 'CANCELLED'
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
export type PaymentMethod = 'CASH' | 'BANK' | 'CHEQUE' | 'MOBILE_MONEY' | 'CARD'
export type InvoiceApprovalDocumentType = 'LPO' | 'DELIVERY_NOTE'

export type Invoice = {
  id: string
  invoiceNumber: string
  customerId: string
  proformaId: string | null
  status: InvoiceStatus
  paymentStatus: PaymentStatus
  issueDate: string
  dueDate?: string | null
  currency: string
  totalAmount: string
  totalPaid: string
  balanceDue: string
  customer?: { id: string; companyName: string }
  proforma?: { id: string; proformaNumber: string }
  payments?: {
    id: string
    paymentNumber: string
    method: PaymentMethod
    amount: string
    paidAt: string
    reference?: string | null
    receiptPath?: string | null
  }[]
}

export type PaginatedInvoices = {
  data: Invoice[]
  total: number
  limit: number
  skip: number
}

export async function fetchInvoices(params: {
  limit: number
  skip: number
  search?: string
  status?: InvoiceStatus
  paymentStatus?: PaymentStatus
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.paymentStatus) query.set('paymentStatus', params.paymentStatus)
  return apiRequest<PaginatedInvoices>(`/invoices?${query.toString()}`)
}

export async function fetchInvoiceById(id: string) {
  return apiRequest<Invoice>(`/invoices/${id}`)
}

export async function updateInvoiceStatus(
  id: string,
  payload: {
    status: InvoiceStatus
    approvalDocumentType?: InvoiceApprovalDocumentType
    approvalComments?: string
    approvalAmount?: number
    attachment?: File
  },
) {
  if (payload.attachment) {
    const formData = new FormData()
    formData.append('status', payload.status)
    if (payload.approvalDocumentType) formData.append('approvalDocumentType', payload.approvalDocumentType)
    if (payload.approvalComments) formData.append('approvalComments', payload.approvalComments)
    if (payload.approvalAmount !== undefined) formData.append('approvalAmount', String(payload.approvalAmount))
    formData.append('attachment', payload.attachment)
    return apiRequest<Invoice>(`/invoices/${id}/status`, {
      method: 'PATCH',
      body: formData,
    })
  }
  return apiRequest<Invoice>(`/invoices/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function recordInvoicePayment(
  id: string,
  payload: {
    amount: number
    method: PaymentMethod
    reference?: string
    paidAt?: string
    notes?: string
    proof?: File
  },
) {
  const formData = new FormData()
  formData.append('amount', String(payload.amount))
  formData.append('method', payload.method)
  if (payload.reference) formData.append('reference', payload.reference)
  if (payload.paidAt) formData.append('paidAt', payload.paidAt)
  if (payload.notes) formData.append('notes', payload.notes)
  if (payload.proof) formData.append('proof', payload.proof)
  return apiRequest(`/invoices/${id}/payments`, {
    method: 'POST',
    body: formData,
  })
}

export async function deleteInvoice(id: string) {
  return apiRequest<Invoice>(`/invoices/${id}`, {
    method: 'DELETE',
  })
}

export async function fetchInvoicePdf(id: string) {
  return apiBlobRequest(`/invoices/${id}/pdf`)
}

export async function fetchInvoicePaymentProof(paymentId: string) {
  return apiBlobRequest(`/invoices/payments/${paymentId}/proof`)
}
