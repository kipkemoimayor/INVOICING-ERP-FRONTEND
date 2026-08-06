<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  convertProformaToInvoice,
  deleteProforma,
  fetchProformaPdf,
  fetchProformas,
  type Proforma,
  type ProformaStatus,
  updateProformaStatus,
} from '@/api/proformas'
import { extractApiErrorMessage } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'

type ToastType = 'success' | 'error'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{ search: string; status: '' | ProformaStatus }>({
  search: '',
  status: '',
})
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined
const isPreviewOpen = ref(false)
const previewUrl = ref('')
const isPreviewLoading = ref(false)
const previewError = ref('')

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const proformasQuery = useQuery({
  queryKey: computed(() => ['proformas', pagination.limit, skip.value, filters.search, filters.status]),
  queryFn: () =>
    fetchProformas({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
    }),
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil((proformasQuery.data.value?.total ?? 0) / pagination.limit)),
)

const invalidateProformas = async () => {
  await queryClient.invalidateQueries({ queryKey: ['proformas'] })
}

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: ProformaStatus }) => updateProformaStatus(id, status),
  onSuccess: async () => {
    await invalidateProformas()
    showToast('success', 'Proforma status updated.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const convertMutation = useMutation({
  mutationFn: convertProformaToInvoice,
  onSuccess: async () => {
    await invalidateProformas()
    showToast('success', 'Proforma converted to invoice.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const deleteMutation = useMutation({
  mutationFn: deleteProforma,
  onSuccess: async () => {
    await invalidateProformas()
    showToast('success', 'Proforma deleted.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const badgeTone = (status: ProformaStatus) => {
  if (status === 'PAID') return 'success'
  if (status === 'CANCELLED') return 'danger'
  if (status === 'APPROVED') return 'warning'
  return 'default'
}

const nextStatus = (proforma: Proforma): ProformaStatus | null => {
  if (proforma.status === 'PENDING') return 'APPROVED'
  if (proforma.status === 'APPROVED') return 'PAID'
  return null
}

const closePreview = () => {
  isPreviewOpen.value = false
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  previewError.value = ''
}

const openPreview = async (proformaId: string) => {
  closePreview()
  isPreviewOpen.value = true
  isPreviewLoading.value = true
  try {
    const blob = await fetchProformaPdf(proformaId)
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    previewError.value = extractApiErrorMessage(error, 'Failed to load proforma preview.')
  } finally {
    isPreviewLoading.value = false
  }
}

const printProformaPdf = async (proformaId: string) => {
  try {
    const blob = await fetchProformaPdf(proformaId)
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => win.print()
      showToast('success', 'Proforma PDF generated.')
    } else {
      showToast('error', 'Popup blocked. Allow popups to print PDF.')
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  }
}
</script>

<template>
  <section class="space-y-4">
    <header>
      <h3 class="text-xl font-semibold">Proforma Invoices</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">Auto-generated from accepted quotations and ready for approval/payment workflow.</p>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search proforma/customer/quotation..." type="search" />
        <select v-model="filters.status" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div v-if="proformasQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading proformas...</div>
      <div v-else-if="proformasQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load proformas.</div>
      <div v-else-if="(proformasQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No proformas found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Proforma #</th>
              <th class="px-3 py-2">Quotation #</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Issue Date</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proforma in proformasQuery.data.value?.data ?? []" :key="proforma.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ proforma.proformaNumber }}</td>
              <td class="px-3 py-3">{{ proforma.quotation?.quotationNumber ?? '-' }}</td>
              <td class="px-3 py-3">{{ proforma.customer?.companyName ?? '-' }}</td>
              <td class="px-3 py-3">{{ new Date(proforma.issueDate).toLocaleDateString() }}</td>
              <td class="px-3 py-3">{{ proforma.totalAmount }} {{ proforma.currency || 'KSH' }}</td>
              <td class="px-3 py-3"><StatusBadge :label="proforma.status" :tone="badgeTone(proforma.status)" /></td>
              <td class="px-3 py-3 text-right space-x-2">
                <button
                  v-if="nextStatus(proforma)"
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  @click="statusMutation.mutate({ id: proforma.id, status: nextStatus(proforma)! })"
                >
                  Mark {{ nextStatus(proforma) }}
                </button>
                <button
                  v-if="proforma.status === 'APPROVED' || proforma.status === 'PAID'"
                  class="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-700"
                  @click="convertMutation.mutate(proforma.id)"
                >
                  Convert to Invoice
                </button>
                <button
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  @click="openPreview(proforma.id)"
                >
                  Preview
                </button>
                <button
                  class="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700"
                  @click="printProformaPdf(proforma.id)"
                >
                  PDF / Print
                </button>
                <button
                  v-if="proforma.status !== 'PAID'"
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  @click="deleteMutation.mutate(proforma.id)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ proformasQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>
    <div v-if="isPreviewOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div class="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-3 flex items-center justify-between">
          <h4 class="text-base font-semibold">Proforma Preview</h4>
          <button class="text-sm text-slate-500" @click="closePreview">Close</button>
        </div>
        <div class="h-[75vh] rounded-lg border border-slate-200 dark:border-slate-800">
          <div v-if="isPreviewLoading" class="flex h-full items-center justify-center text-sm text-slate-500">Loading preview...</div>
          <div v-else-if="previewError" class="flex h-full items-center justify-center text-sm text-rose-600">{{ previewError }}</div>
          <iframe v-else-if="previewUrl" :src="previewUrl" class="h-full w-full rounded-lg" />
        </div>
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
