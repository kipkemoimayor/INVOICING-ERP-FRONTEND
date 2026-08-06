<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchTenantConfiguration,
  uploadTenantLogo,
  updateTenantConfiguration,
} from '@/api/settings'
import { API_BASE_URL, extractApiErrorMessage } from '@/lib/api'

const queryClient = useQueryClient()
const toast = ref<{ type: 'success' | 'error'; message: string } | null>(null)
let toastTimer: number | undefined

const form = reactive({
  companyName: '',
  tradeName: '',
  tagline: '',
  postalAddress: '',
  physicalAddress: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  preparedByLabel: 'Prepared by',
  lpoLabel: 'LPO NO',
  commentsLabel: 'Comments or Special Instructions',
  defaultCurrency: 'KSH',
  defaultTaxPercent: 16,
  quotationNumberStart: 100,
  skipProforma: false,
  defaultTerms: 'Due on receipt',
})

const settingsQuery = useQuery({
  queryKey: ['tenant-settings'],
  queryFn: fetchTenantConfiguration,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
})

const logoUrl = computed(() =>
  settingsQuery.data.value?.logoPath
    ? `${API_BASE_URL}/settings/tenant/logo?t=${Date.now()}`
    : '',
)

const showToast = (type: 'success' | 'error', message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 2800)
}

const syncForm = () => {
  const data = settingsQuery.data.value
  if (!data) return
  form.companyName = data.companyName ?? ''
  form.tradeName = data.tradeName ?? ''
  form.tagline = data.tagline ?? ''
  form.postalAddress = data.postalAddress ?? ''
  form.physicalAddress = data.physicalAddress ?? ''
  form.city = data.city ?? ''
  form.phone = data.phone ?? ''
  form.email = data.email ?? ''
  form.website = data.website ?? ''
  form.preparedByLabel = data.preparedByLabel ?? 'Prepared by'
  form.lpoLabel = data.lpoLabel ?? 'LPO NO'
  form.commentsLabel = data.commentsLabel ?? 'Comments or Special Instructions'
  form.defaultCurrency = data.defaultCurrency ?? 'KSH'
  form.defaultTaxPercent = Number(data.defaultTaxPercent ?? 0)
  form.quotationNumberStart = Number(data.quotationNumberStart ?? 100)
  form.skipProforma = Boolean(data.skipProforma ?? false)
  form.defaultTerms = data.defaultTerms ?? 'Due on receipt'
}

const updateMutation = useMutation({
  mutationFn: updateTenantConfiguration,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['tenant-settings'] })
    showToast('success', 'Tenant configuration saved.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error, 'Failed to save tenant configuration.')),
})

const uploadMutation = useMutation({
  mutationFn: uploadTenantLogo,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['tenant-settings'] })
    showToast('success', 'Logo uploaded.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error, 'Failed to upload logo.')),
})

const onSave = async () => {
  await updateMutation.mutateAsync({
    companyName: form.companyName.trim(),
    tradeName: form.tradeName.trim() || undefined,
    tagline: form.tagline.trim() || undefined,
    postalAddress: form.postalAddress.trim() || undefined,
    physicalAddress: form.physicalAddress.trim() || undefined,
    city: form.city.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    website: form.website.trim() || undefined,
    preparedByLabel: form.preparedByLabel.trim() || undefined,
    lpoLabel: form.lpoLabel.trim() || undefined,
    commentsLabel: form.commentsLabel.trim() || undefined,
    defaultCurrency: form.defaultCurrency.trim().toUpperCase() || 'KSH',
    defaultTaxPercent: Number(form.defaultTaxPercent) || 0,
    quotationNumberStart: Math.max(1, Math.floor(Number(form.quotationNumberStart) || 100)),
    skipProforma: form.skipProforma,
    defaultTerms: form.defaultTerms.trim() || undefined,
  })
}

const onLogoChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await uploadMutation.mutateAsync(file)
  input.value = ''
}

watch(
  () => settingsQuery.data.value,
  () => syncForm(),
  { immediate: true },
)
</script>

<template>
  <section class="space-y-4">
    <header>
      <h3 class="text-xl font-semibold">Tenant / Company Configuration</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Configure branding for quotation and invoice templates.
      </p>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 grid gap-4 sm:grid-cols-3">
        <div class="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <input v-model="form.companyName" placeholder="Company Name" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" />
          <input v-model="form.tradeName" placeholder="Trade Name" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.tagline" placeholder="Tagline" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.postalAddress" placeholder="Postal Address" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.physicalAddress" placeholder="Physical Address" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.city" placeholder="City" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.phone" placeholder="Phone" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.email" placeholder="Email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.website" placeholder="Website" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.defaultCurrency" placeholder="Default Currency (KSH)" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model.number="form.defaultTaxPercent" placeholder="Default Tax % (e.g 16)" type="number" min="0" step="0.01" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model.number="form.quotationNumberStart" placeholder="Quotation Number Start (e.g 100)" type="number" min="1" step="1" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="form.skipProforma" type="checkbox" class="h-4 w-4" />
            Skip Proforma and convert accepted quotation directly to Invoice
          </label>
          <input v-model="form.preparedByLabel" placeholder="Prepared By Label" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.lpoLabel" placeholder="LPO Label" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input v-model="form.commentsLabel" placeholder="Comments Label" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" />
          <input v-model="form.defaultTerms" placeholder="Default Terms" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" />
        </div>
        <div class="space-y-3">
          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p class="mb-2 text-xs text-slate-500">Current Logo</p>
            <img v-if="logoUrl" :src="logoUrl" alt="Tenant Logo" class="h-24 w-full rounded object-contain" />
            <p v-else class="text-xs text-slate-500">No logo uploaded</p>
          </div>
          <input type="file" accept="image/*" class="block w-full text-sm" @change="onLogoChange" />
        </div>
      </div>

      <div class="flex justify-end">
        <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="onSave">
          Save Configuration
        </button>
      </div>
    </div>

    <div
      v-if="toast"
      class="fixed right-4 top-4 z-[70] rounded-lg px-4 py-3 text-sm shadow-lg"
      :class="toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
    >
      {{ toast.message }}
    </div>
  </section>
</template>
