export const AUTH_SESSION_STORAGE_KEY = 'sales-auth-session'

export type AuthSessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  roles: string[]
  permissions: string[]
}

export type AuthSession = {
  accessToken: string
  user: AuthSessionUser
}

export const getAuthSession = (): AuthSession | null => {
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export const setAuthSession = (session: AuthSession) => {
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export const clearAuthSession = () => {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

export const getAuthToken = () => getAuthSession()?.accessToken ?? ''

export const getAuthPermissions = () => getAuthSession()?.user.permissions ?? []

export const hasPermission = (permission: string) => {
  const permissions = new Set(getAuthPermissions())
  return permissions.has(permission)
}
