import { apiRequest } from '@/lib/api'

export type DashboardStats = {
  cards: {
    todaySales: number
    outstandingQuotations: number
    pendingDeliveries: number
    pendingPayments: number
    revenue: number
    invoices: number
  }
  revenueTrend: { month: string; total: number }[]
  topCustomers: { customerId: string; customerName: string; amount: number }[]
  recentActivities: {
    id: string
    createdAt: string
    action: string
    resourceType: string
    message: string
  }[]
}

export async function fetchDashboardStats() {
  return apiRequest<DashboardStats>('/dashboard/stats')
}
