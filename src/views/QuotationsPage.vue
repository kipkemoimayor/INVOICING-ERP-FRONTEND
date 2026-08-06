<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchCustomers } from '@/api/customers'
import { fetchProducts, type Product } from '@/api/products'
import { fetchTenantConfiguration } from '@/api/settings'
import {
  convertQuotationToInvoice,
  convertQuotationToProforma,
  createQuotation,
  deleteQuotation,
  fetchQuotationPdf,
  fetchQuotations,
  resendQuotationEmail,
  updateQuotationStatus,
  type Quotation,
  type QuotationItemPayload,
  type QuotationStatus,
} from '@/api/quotations'
import { extractApiErrorMessage } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const DEFAULT_CURRENCY = 'KSH'
const SERVICE_UNITS = new Set(['service', 'job', 'task', 'repair'])

type QuotationFormItem = {
  productId?: string
  description?: string
  quantity?: number
  unitPrice?: number
}

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{ search: string; status: '' | QuotationStatus }>({
  search: '',
  status: '',
})

const isModalOpen = ref(false)
const isPreviewOpen = ref(false)
const previewUrl = ref('')
const isPreviewLoading = ref(false)
const previewError = ref('')
const activeStatusId = ref('')
const activeConvertId = ref('')
const activeDeleteId = ref('')
const activeResendId = ref('')
const activePrintId = ref('')
const activePreviewId = ref('')
const toast = ref<{ type: 'success' | 'error'; message: string } | null>(null)
let toastTimer: number | undefined
const form = reactive({
  customerId: '',
  issueDate: '',
  expiryDate: '',
  currency: DEFAULT_CURRENCY,
  notes: '',
  items: [{ productId: '', description: '', quantity: 1, unitPrice: 0 }] as QuotationFormItem[],
})

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const customersQuery = useQuery({
  queryKey: ['quotation-customers'],
  queryFn: () => fetchCustomers({ limit: 200, skip: 0 }),
})

const productsQuery = useQuery({
  queryKey: ['quotation-products'],
  queryFn: () => fetchProducts({ limit: 300, skip: 0, isActive: true }),
})

const quotationsQuery = useQuery({
  queryKey: computed(() => ['quotations', pagination.limit, skip.value, filters.search, filters.status]),
  queryFn: () =>
    fetchQuotations({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
    }),
})

const settingsQuery = useQuery({
  queryKey: ['tenant-settings-for-quotation'],
  queryFn: fetchTenantConfiguration,
})
const skipProformaWorkflow = computed(() => Boolean(settingsQuery.data.value?.skipProforma))

const totalPages = computed(() =>
  Math.max(1, Math.ceil((quotationsQuery.data.value?.total ?? 0) / pagination.limit)),
)

const invalidateQuotations = async () => {
  await queryClient.invalidateQueries({ queryKey: ['quotations'] })
}

const createMutation = useMutation({
  mutationFn: createQuotation,
  onSuccess: async () => {
    await invalidateQuotations()
    isModalOpen.value = false
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const updateStatusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: QuotationStatus }) =>
    updateQuotationStatus(id, status),
  onSuccess: async () => {
    await invalidateQuotations()
    activeStatusId.value = ''
    showToast('success', 'Quotation status updated.')
  },
  onError: (error) => {
    activeStatusId.value = ''
    showToast('error', extractApiErrorMessage(error))
  },
})

const convertMutation = useMutation({
  mutationFn: ({ id, skipProforma }: { id: string; skipProforma: boolean }) =>
    skipProforma ? convertQuotationToInvoice(id) : convertQuotationToProforma(id),
  onSuccess: async (_data, variables) => {
    await invalidateQuotations()
    activeConvertId.value = ''
    showToast('success', variables.skipProforma ? 'Quotation converted to invoice.' : 'Quotation converted to proforma.')
  },
  onError: (error) => {
    activeConvertId.value = ''
    showToast('error', extractApiErrorMessage(error))
  },
})

const resendEmailMutation = useMutation({
  mutationFn: resendQuotationEmail,
  onSuccess: () => {
    activeResendId.value = ''
    showToast('success', 'Quotation email resent successfully.')
  },
  onError: (error) => {
    activeResendId.value = ''
    showToast('error', extractApiErrorMessage(error))
  },
})

const deleteMutation = useMutation({
  mutationFn: deleteQuotation,
  onSuccess: async () => {
    await invalidateQuotations()
    activeDeleteId.value = ''
    showToast('success', 'Quotation deleted.')
  },
  onError: (error) => {
    activeDeleteId.value = ''
    showToast('error', extractApiErrorMessage(error))
  },
})

const addItemRow = () => {
  form.items.push({ productId: '', description: '', quantity: 1, unitPrice: 0 })
}

const removeItemRow = (index: number) => {
  if (form.items.length === 1) return
  form.items.splice(index, 1)
}

const resetForm = () => {
  form.customerId = ''
  form.issueDate = ''
  form.expiryDate = ''
  form.currency = DEFAULT_CURRENCY
  form.notes = ''
  form.items = [{ productId: '', description: '', quantity: 1, unitPrice: 0 }]
}

const productById = computed(() => {
  const map = new Map<string, Product>()
  for (const product of productsQuery.data.value?.data ?? []) {
    map.set(product.id, product)
  }
  return map
})

const isServiceProduct = (productId?: string) => {
  if (!productId) return true
  const product = productById.value.get(productId)
  if (!product) return false
  const categoryName = product.category?.name?.toLowerCase() ?? ''
  return categoryName.includes('service') || SERVICE_UNITS.has(product.unit.toLowerCase())
}

const itemQuantity = (item: QuotationFormItem) => {
  return isServiceProduct(item.productId) ? 1 : Number(item.quantity ?? 0)
}

const itemUnitPrice = (item: QuotationFormItem) => {
  if (item.unitPrice !== undefined && Number(item.unitPrice) > 0) {
    return Number(item.unitPrice)
  }
  if (item.productId) {
    const product = productById.value.get(item.productId)
    return Number(product?.sellingPrice ?? 0)
  }
  return 0
}

const taxPercent = computed(() => Number(settingsQuery.data.value?.defaultTaxPercent ?? 0))
const subtotalPreview = computed(() =>
  form.items.reduce((sum, item) => sum + itemQuantity(item) * itemUnitPrice(item), 0),
)
const taxPreview = computed(() => (subtotalPreview.value * taxPercent.value) / 100)
const totalPreview = computed(() => subtotalPreview.value + taxPreview.value)

const submitForm = async () => {
  if (!form.customerId) return

  const hasInvalidItem = form.items.some((item) => {
    const hasProduct = Boolean(item.productId)
    const hasDescription = Boolean(item.description?.trim())
    if (!hasProduct && !hasDescription) return true
    if (!hasProduct && itemUnitPrice(item) <= 0) return true
    if (hasProduct && !isServiceProduct(item.productId) && itemQuantity(item) <= 0) return true
    return false
  })
  if (hasInvalidItem) return

  await createMutation.mutateAsync({
    customerId: form.customerId,
    issueDate: form.issueDate || undefined,
    expiryDate: form.expiryDate || undefined,
    currency: form.currency || DEFAULT_CURRENCY,
    notes: form.notes || undefined,
    items: form.items.map((item) => ({
      productId: item.productId || undefined,
      description: item.description?.trim() || undefined,
      quantity: isServiceProduct(item.productId) ? undefined : itemQuantity(item),
      unitPrice: itemUnitPrice(item) || undefined,
    })) as QuotationItemPayload[],
  })
}

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const badgeTone = (status: QuotationStatus) => {
  if (status === 'ACCEPTED') return 'success'
  if (status === 'REJECTED' || status === 'EXPIRED') return 'danger'
  if (status === 'SENT') return 'warning'
  return 'default'
}

const nextStatus = (quotation: Quotation): QuotationStatus | null => {
  if (quotation.status === 'DRAFT') return 'SENT'
  if (quotation.status === 'SENT') return 'ACCEPTED'
  return null
}

const showToast = (type: 'success' | 'error', message: string) => {
  toast.value = { type, message }
  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const printQuotationPdf = async (quotationId: string) => {
  activePrintId.value = quotationId
  try {
    const blob = await fetchQuotationPdf(quotationId)
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => win.print()
      showToast('success', 'Quotation PDF generated.')
    } else {
      showToast('error', 'Popup blocked. Allow popups to print PDF.')
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    showToast('error', 'Failed to generate quotation PDF.')
  } finally {
    activePrintId.value = ''
  }
}

const closePreview = () => {
  isPreviewOpen.value = false
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  previewError.value = ''
}

const openPreview = async (quotationId: string) => {
  activePreviewId.value = quotationId
  closePreview()
  isPreviewOpen.value = true
  isPreviewLoading.value = true
  try {
    const blob = await fetchQuotationPdf(quotationId)
    previewUrl.value = URL.createObjectURL(blob)
  } catch {
    previewError.value = 'Failed to load quotation preview.'
  } finally {
    isPreviewLoading.value = false
    activePreviewId.value = ''
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-xl font-semibold">Quotations</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Create, send, accept, and convert quotations to proforma invoices.</p>
      </div>
      <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="isModalOpen = true">
        New Quotation
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search quotation or customer..." type="search" />
        <select v-model="filters.status" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div v-if="quotationsQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading quotations...</div>
      <div v-else-if="quotationsQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load quotations.</div>
      <div v-else-if="(quotationsQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No quotations found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Number</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Issue Date</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="quotation in quotationsQuery.data.value?.data ?? []" :key="quotation.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ quotation.quotationNumber }}</td>
              <td class="px-3 py-3">{{ quotation.customer?.companyName ?? '-' }}</td>
              <td class="px-3 py-3">{{ new Date(quotation.issueDate).toLocaleDateString() }}</td>
              <td class="px-3 py-3">{{ quotation.totalAmount }} {{ quotation.currency || DEFAULT_CURRENCY }}</td>
              <td class="px-3 py-3"><StatusBadge :label="quotation.status" :tone="badgeTone(quotation.status)" /></td>
              <td class="px-3 py-3 text-right space-x-2">
                <button
                  v-if="nextStatus(quotation)"
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  :disabled="activeStatusId === quotation.id"
                  @click="activeStatusId = quotation.id; updateStatusMutation.mutate({ id: quotation.id, status: nextStatus(quotation)! })"
                >
                  {{ activeStatusId === quotation.id ? 'Processing...' : `Mark ${nextStatus(quotation)}` }}
                </button>
                <button
                  v-if="quotation.status === 'ACCEPTED'"
                  class="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-700"
                  :disabled="activeConvertId === quotation.id"
                  @click="activeConvertId = quotation.id; convertMutation.mutate({ id: quotation.id, skipProforma: skipProformaWorkflow })"
                >
                  {{ activeConvertId === quotation.id ? 'Converting...' : (skipProformaWorkflow ? 'Convert to Invoice' : 'Convert to Proforma') }}
                </button>
                <button
                  v-if="quotation.status !== 'ACCEPTED'"
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  :disabled="activeDeleteId === quotation.id"
                  @click="activeDeleteId = quotation.id; deleteMutation.mutate(quotation.id)"
                >
                  {{ activeDeleteId === quotation.id ? 'Deleting...' : 'Delete' }}
                </button>
                <button
                  v-if="quotation.status === 'SENT' || quotation.status === 'ACCEPTED'"
                  class="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700 dark:border-blue-700"
                  :disabled="activeResendId === quotation.id"
                  @click="activeResendId = quotation.id; resendEmailMutation.mutate(quotation.id)"
                >
                  {{ activeResendId === quotation.id ? 'Sending...' : 'Resend Email' }}
                </button>
                <button
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  :disabled="activePreviewId === quotation.id"
                  @click="openPreview(quotation.id)"
                >
                  {{ activePreviewId === quotation.id ? 'Loading...' : 'Preview' }}
                </button>
                <button
                  class="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700"
                  :disabled="activePrintId === quotation.id"
                  @click="printQuotationPdf(quotation.id)"
                >
                  {{ activePrintId === quotation.id ? 'Generating...' : 'PDF / Print' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ quotationsQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">Create Quotation</h4>
          <button class="text-sm text-slate-500" @click="isModalOpen = false">Close</button>
        </div>
        <form class="space-y-4" @submit.prevent="submitForm">
          <div class="grid gap-3 sm:grid-cols-2">
            <select v-model="form.customerId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">Select customer</option>
              <option v-for="customer in customersQuery.data.value?.data ?? []" :key="customer.id" :value="customer.id">
                {{ customer.companyName }}
              </option>
            </select>
            <input
              v-model="form.currency"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              readonly
              placeholder="Currency"
            />
            <input v-model="form.issueDate" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" />
            <input v-model="form.expiryDate" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" />
            <textarea v-model="form.notes" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" rows="2" placeholder="Notes" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium">Items</p>
              <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" type="button" @click="addItemRow">Add Item</button>
            </div>
            <div v-for="(item, index) in form.items" :key="index" class="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-6 dark:border-slate-800">
              <select v-model="item.productId" class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 sm:col-span-2">
                <option value="">Product</option>
                <option v-for="product in productsQuery.data.value?.data ?? []" :key="product.id" :value="product.id">{{ product.name }}</option>
              </select>
              <textarea v-model="item.description" rows="1" class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Description (or leave blank to use product defaults)" />
              <input
                v-if="!isServiceProduct(item.productId)"
                v-model.number="item.quantity"
                class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                type="number"
                min="0.001"
                step="0.001"
                placeholder="Qty"
              />
              <p
                v-else
                class="rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 dark:border-slate-700"
              >
                Service line item (Qty fixed to 1)
              </p>
              <input v-model.number="item.unitPrice" class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" type="number" min="0" step="0.01" placeholder="Unit Price" />
              <div class="flex items-center justify-end">
                <button class="rounded border border-rose-300 px-2 py-1 text-[10px] text-rose-600 dark:border-rose-700" type="button" @click="removeItemRow(index)">Remove</button>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p class="font-medium">Quotation Totals Preview</p>
            <div class="mt-2 grid gap-1 sm:max-w-sm sm:ml-auto">
              <div class="flex items-center justify-between"><span>Subtotal</span><span>{{ form.currency }} {{ subtotalPreview.toFixed(2) }}</span></div>
              <div class="flex items-center justify-between"><span>Tax ({{ taxPercent.toFixed(2) }}%)</span><span>{{ form.currency }} {{ taxPreview.toFixed(2) }}</span></div>
              <div class="flex items-center justify-between font-semibold"><span>Total</span><span>{{ form.currency }} {{ totalPreview.toFixed(2) }}</span></div>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" @click="resetForm">Reset</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" :disabled="createMutation.isPending.value" type="submit">
              {{ createMutation.isPending.value ? 'Creating...' : 'Create Quotation' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="isPreviewOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div class="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-3 flex items-center justify-between">
          <h4 class="text-base font-semibold">Quotation Preview</h4>
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
      :class="toast.type === 'success'
        ? 'bg-emerald-600 text-white'
        : 'bg-rose-600 text-white'"
    >
      {{ toast.message }}
    </div>
  </section>
</template>
