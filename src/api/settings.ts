import { API_BASE_URL, apiRequest } from '@/lib/api'

export type TenantConfiguration = {
  companyName: string
  tradeName?: string | null
  tagline?: string | null
  postalAddress?: string | null
  physicalAddress?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  preparedByLabel?: string | null
  lpoLabel?: string | null
  commentsLabel?: string | null
  defaultCurrency: string
  defaultTaxPercent: string | number
  quotationNumberStart: number
  skipProforma: boolean
  defaultTerms?: string | null
  logoPath?: string | null
}

export type TenantConfigurationPayload = Partial<TenantConfiguration>

export async function fetchTenantConfiguration() {
  return apiRequest<TenantConfiguration>('/settings/tenant')
}

export async function updateTenantConfiguration(payload: TenantConfigurationPayload) {
  return apiRequest<TenantConfiguration>('/settings/tenant', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function uploadTenantLogo(file: File) {
  const formData = new FormData()
  formData.append('logo', file)

  const response = await fetch(`${API_BASE_URL}/settings/tenant/logo`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    try {
      const parsed = JSON.parse(errorBody) as { message?: string | string[]; error?: string }
      if (Array.isArray(parsed.message)) {
        return Promise.reject(new Error(parsed.message.join(', ')))
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return Promise.reject(new Error(parsed.message))
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return Promise.reject(new Error(parsed.error))
      }
    } catch {
      // Response is not JSON.
    }
    throw new Error(errorBody || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<{ logoPath: string }>
}
