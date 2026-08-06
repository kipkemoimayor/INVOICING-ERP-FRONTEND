import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { bootstrapAdmin, login, logout, me } from '@/api/auth'
import {
  clearAuthSession,
  getAuthSession,
  hasPermission as hasStoredPermission,
  setAuthSession,
  type AuthSessionUser,
} from '@/lib/auth'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref('')
  const user = ref<AuthSessionUser | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => Boolean(accessToken.value && user.value))
  const displayName = computed(() => {
    if (!user.value) return ''
    return `${user.value.firstName} ${user.value.lastName}`.trim()
  })

  const persist = () => {
    if (!accessToken.value || !user.value) {
      clearAuthSession()
      return
    }
    setAuthSession({
      accessToken: accessToken.value,
      user: user.value,
    })
  }

  const hydrate = () => {
    const session = getAuthSession()
    if (session) {
      accessToken.value = session.accessToken
      user.value = session.user
    }
    initialized.value = true
  }

  const hasPermission = (permission: string) => {
    if (!isAuthenticated.value) return false
    if (!user.value) return false
    return user.value.permissions.includes(permission) || hasStoredPermission(permission)
  }

  const signIn = async (email: string, password: string) => {
    const response = await login({ email, password })
    accessToken.value = response.accessToken
    user.value = response.user
    persist()
    return response
  }

  const refreshMe = async () => {
    if (!accessToken.value) return null
    const response = await me()
    user.value = response
    persist()
    return response
  }

  const signOut = async () => {
    if (accessToken.value) {
      try {
        await logout()
      } catch {}
    }
    accessToken.value = ''
    user.value = null
    persist()
  }

  const bootstrap = async (payload: {
    email: string
    password: string
    firstName?: string
    lastName?: string
  }) => {
    return bootstrapAdmin(payload)
  }

  return {
    accessToken,
    user,
    initialized,
    isAuthenticated,
    displayName,
    hydrate,
    hasPermission,
    signIn,
    refreshMe,
    signOut,
    bootstrap,
  }
})
