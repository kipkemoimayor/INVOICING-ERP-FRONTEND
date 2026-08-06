import { getAuthToken, hasPermission } from './auth'
import { getPermissionForApiAction } from './permission-map'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.toString() || 'https://invoicing-erp-cofk-two.vercel.app/api'

type ApiErrorBody = {
  message?: string | string[]
  error?: string
  statusCode?: number
}

const toApiErrorMessage = (body: string, fallbackStatus: number) => {
  if (!body) return `Request failed with status ${fallbackStatus}`
  try {
    const parsed = JSON.parse(body) as ApiErrorBody
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ')
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message
    }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error
    }
  } catch {
    // Response was not JSON
  }
  return body
}

export const extractApiErrorMessage = (error: unknown, fallback?: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback || 'Request failed. Please try again.'
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const requiredPermission = getPermissionForApiAction(path, method)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    throw new Error(`You do not have permission to perform this action (${requiredPermission}).`)
  }

  const isFormDataBody = init?.body instanceof FormData
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(toApiErrorMessage(errorBody, response.status))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiBlobRequest(path: string, init?: RequestInit): Promise<Blob> {
  const method = (init?.method || 'GET').toUpperCase()
  const requiredPermission = getPermissionForApiAction(path, method)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    throw new Error(`You do not have permission to perform this action (${requiredPermission}).`)
  }

  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(toApiErrorMessage(errorBody, response.status))
  }

  return response.blob()
}
