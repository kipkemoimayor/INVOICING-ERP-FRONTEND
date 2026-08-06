import { apiBlobRequest, apiRequest } from '@/lib/api'

export type EmailReportItem = {
  id: string
  createdAt: string
  quotationId?: string | null
  quotationNumber?: string | null
  recipient?: string | null
  subject?: string | null
  status: 'SUCCESS' | 'FAILED'
  message?: string | null
  error?: string | null
}

export type EmailReportResponse = {
  data: EmailReportItem[]
  total: number
  limit: number
  skip: number
}

export type ReportsOverview = {
  filters: {
    fromDate?: string | null
    toDate?: string | null
    customerId?: string | null
  }
  cards: {
    quotationsCount: number
    quotationsAccepted: number
    quotationAmount: number
    invoicesCount: number
    invoiceAmount: number
    invoiceTaxAmount: number
    paymentsCount: number
    paymentsAmount: number
    outstandingAmount: number
    pendingDeliveries: number
  }
  topCustomers: Array<{
    customerId: string
    customerName: string
    invoiceCount: number
    totalAmount: number
  }>
  topProducts: Array<{
    productId: string
    productName: string
    sku?: string | null
    quantity: number
    revenue: number
  }>
  revenueTrend: Array<{
    month: string
    amount: number
  }>
}

export type SalesReportInvoice = {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate?: string | null
  status: string
  paymentStatus: string
  currency: string
  subtotal: string
  taxAmount: string
  totalAmount: string
  totalPaid: string
  balanceDue: string
  customer?: { id: string; companyName: string }
}

export type SalesReportResponse = {
  data: SalesReportInvoice[]
  total: number
  limit: number
  skip: number
  totals: {
    subtotal: number
    taxAmount: number
    totalAmount: number
    totalPaid: number
    balanceDue: number
  }
}

export type SalesReportFilters = {
  limit?: number
  skip?: number
  search?: string
  fromDate?: string
  toDate?: string
  customerId?: string
  status?: string
  paymentStatus?: string
}

const buildSalesQuery = (params: SalesReportFilters) => {
  const query = new URLSearchParams()
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.skip !== undefined) query.set('skip', String(params.skip))
  if (params.search) query.set('search', params.search)
  if (params.fromDate) query.set('fromDate', params.fromDate)
  if (params.toDate) query.set('toDate', params.toDate)
  if (params.customerId) query.set('customerId', params.customerId)
  if (params.status) query.set('status', params.status)
  if (params.paymentStatus) query.set('paymentStatus', params.paymentStatus)
  return query.toString()
}

export async function fetchEmailReport(params: {
  limit: number
  skip: number
  search?: string
  status?: 'SUCCESS' | 'FAILED'
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  return apiRequest<EmailReportResponse>(`/reports/email?${query.toString()}`)
}

export async function fetchReportsOverview(params: SalesReportFilters) {
  return apiRequest<ReportsOverview>(`/reports/overview?${buildSalesQuery(params)}`)
}

export async function fetchSalesReport(params: SalesReportFilters) {
  return apiRequest<SalesReportResponse>(`/reports/sales?${buildSalesQuery(params)}`)
}

export async function exportSalesReportExcel(params: SalesReportFilters) {
  return apiBlobRequest(`/reports/sales/export?${buildSalesQuery(params)}`)
}
