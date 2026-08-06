<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { fetchBootstrapStatus } from '@/api/auth'
import { extractApiErrorMessage } from '@/lib/api'

type ToastType = 'success' | 'error'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loginForm = reactive({
  email: '',
  password: '',
})
const bootstrapForm = reactive({
  email: '',
  password: '',
  firstName: 'System',
  lastName: 'Administrator',
})
const loading = ref(false)
const bootstrapLoading = ref(false)
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined
const canBootstrapAdmin = ref(false)
const bootstrapStatusLoading = ref(true)

const loadBootstrapStatus = async () => {
  bootstrapStatusLoading.value = true
  try {
    const response = await fetchBootstrapStatus()
    canBootstrapAdmin.value = response.canBootstrapAdmin
  } catch {
    canBootstrapAdmin.value = false
  } finally {
    bootstrapStatusLoading.value = false
  }
}

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 3200)
}

const submitLogin = async () => {
  if (!loginForm.email.trim() || !loginForm.password.trim()) {
    showToast('error', 'Email and password are required.')
    return
  }
  loading.value = true
  try {
    await authStore.signIn(loginForm.email, loginForm.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

const submitBootstrap = async () => {
  if (!bootstrapForm.email.trim() || !bootstrapForm.password.trim()) {
    showToast('error', 'Bootstrap email and password are required.')
    return
  }
  bootstrapLoading.value = true
  try {
    const response = await authStore.bootstrap({
      email: bootstrapForm.email,
      password: bootstrapForm.password,
      firstName: bootstrapForm.firstName,
      lastName: bootstrapForm.lastName,
    })
    showToast('success', response.message)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    bootstrapLoading.value = false
  }
}

void loadBootstrapStatus()
</script>

<template>
  <section class="min-h-screen bg-slate-100 dark:bg-slate-900">
    <div class="mx-auto grid min-h-screen w-full max-w-7xl items-stretch lg:grid-cols-2">
      <div class="flex items-center justify-center px-4 py-8 lg:px-10">
        <div class="w-full max-w-md space-y-5">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div class="mb-5 flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                SM
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">Sales Management</p>
                <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h1>
              </div>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400">Sign in to continue to your workspace.</p>
            <form class="mt-6 grid gap-3" @submit.prevent="submitLogin">
              <input v-model="loginForm.email" type="email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Email" />
              <input v-model="loginForm.password" type="password" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Password" />
              <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" :disabled="loading">
                {{ loading ? 'Signing in...' : 'Sign In' }}
              </button>
            </form>
          </div>

          <div v-if="canBootstrapAdmin && !bootstrapStatusLoading" class="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm dark:border-amber-800 dark:bg-amber-950/20">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Initial Admin Bootstrap</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Use once on a fresh database to create the first admin user.</p>
            <form class="mt-4 grid gap-2" @submit.prevent="submitBootstrap">
              <input v-model="bootstrapForm.email" type="email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Admin email" />
              <input v-model="bootstrapForm.password" type="password" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Admin password" />
              <input v-model="bootstrapForm.firstName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="First name" />
              <input v-model="bootstrapForm.lastName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Last name" />
              <button type="submit" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700" :disabled="bootstrapLoading">
                {{ bootstrapLoading ? 'Bootstrapping...' : 'Bootstrap Admin' }}
              </button>
            </form>
          </div>
        </div>
      </div>

      <aside class="relative hidden overflow-hidden border-l border-slate-200 bg-slate-900 p-10 text-slate-100 lg:block dark:border-slate-800">
        <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 opacity-90" />
        <div class="relative z-10 flex h-full flex-col">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">Enterprise Sales ERP</p>
            <h2 class="mt-3 text-3xl font-semibold leading-tight">Manage quotations, invoices, deliveries, and payments in one secure workflow.</h2>
            <p class="mt-4 max-w-xl text-sm text-slate-200/90">
              Built for finance, sales, and operations teams with full traceability, role-based access, and production-ready controls.
            </p>
          </div>

          <div class="mt-8 grid gap-3">
            <div class="rounded-xl border border-white/20 bg-white/10 p-4">
              <p class="text-sm font-semibold">Document Lifecycle</p>
              <p class="mt-1 text-xs text-slate-200/90">Quotation → Proforma/Invoice → Tax Invoice → Delivery Note with linked auditability.</p>
            </div>
            <div class="rounded-xl border border-white/20 bg-white/10 p-4">
              <p class="text-sm font-semibold">Financial Control</p>
              <p class="mt-1 text-xs text-slate-200/90">Approval gates, payment proofs, outstanding balances, and report exports.</p>
            </div>
            <div class="rounded-xl border border-white/20 bg-white/10 p-4">
              <p class="text-sm font-semibold">Security & Governance</p>
              <p class="mt-1 text-xs text-slate-200/90">JWT authentication, RBAC permissions, and complete activity logging.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <div
      v-if="toast"
      class="fixed right-4 top-4 z-[80] rounded-lg px-4 py-3 text-sm shadow-lg"
      :class="toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
    >
      {{ toast.message }}
    </div>
  </section>
</template>
