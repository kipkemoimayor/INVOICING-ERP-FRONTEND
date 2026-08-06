import { apiRequest } from '@/lib/api'

export type GlobalSearchItem = {
  type: 'CUSTOMER' | 'PRODUCT' | 'QUOTATION' | 'PROFORMA' | 'INVOICE' | 'DELIVERY_NOTE' | 'PAYMENT'
  id: string
  label: string
  subtitle?: string | null
  route: string
}

export type GlobalSearchResponse = {
  term: string
  data: GlobalSearchItem[]
}

export type QuickViewResponse = {
  item: GlobalSearchItem
  details: Array<{
    label: string
    value: string
  }>
}

export async function globalSearch(params: { q: string; limit?: number }) {
  const query = new URLSearchParams({
    q: params.q,
  })
  if (params.limit) query.set('limit', String(params.limit))
  return apiRequest<GlobalSearchResponse>(`/search/global?${query.toString()}`)
}

export async function fetchQuickView(params: { type: GlobalSearchItem['type']; id: string }) {
  const query = new URLSearchParams({
    type: params.type,
    id: params.id,
  })
  return apiRequest<QuickViewResponse>(`/search/quick-view?${query.toString()}`)
}
