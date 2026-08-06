import { apiBlobRequest, apiRequest } from '@/lib/api'

export type DeliveryStatus = 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'RETURNED'

export type DeliveryNote = {
  id: string
  deliveryNumber: string
  invoiceId: string
  customerId: string
  status: DeliveryStatus
  dispatchDate?: string | null
  deliveredAt?: string | null
  vehicle?: string | null
  driver?: string | null
  receiver?: string | null
  notes?: string | null
  invoice?: { id: string; invoiceNumber: string }
  customer?: { id: string; companyName: string }
}

export type PaginatedDeliveryNotes = {
  data: DeliveryNote[]
  total: number
  limit: number
  skip: number
}

export async function fetchDeliveryNotes(params: {
  limit: number
  skip: number
  search?: string
  status?: DeliveryStatus
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  return apiRequest<PaginatedDeliveryNotes>(`/delivery-notes?${query.toString()}`)
}

export async function createDeliveryNote(payload: {
  invoiceId: string
  dispatchDate?: string
  receiver?: string
  comments: string
  amount?: number
  attachment: File
}) {
  const formData = new FormData()
  formData.append('invoiceId', payload.invoiceId)
  if (payload.dispatchDate) formData.append('dispatchDate', payload.dispatchDate)
  if (payload.receiver) formData.append('receiver', payload.receiver)
  formData.append('comments', payload.comments)
  if (payload.amount !== undefined) formData.append('amount', String(payload.amount))
  formData.append('attachment', payload.attachment)
  return apiRequest<DeliveryNote>('/delivery-notes', {
    method: 'POST',
    body: formData,
  })
}

export async function updateDeliveryNoteStatus(id: string, status: DeliveryStatus) {
  return apiRequest<DeliveryNote>(`/delivery-notes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function fetchDeliveryNoteAttachment(id: string) {
  return apiBlobRequest(`/delivery-notes/${id}/attachment`)
}
