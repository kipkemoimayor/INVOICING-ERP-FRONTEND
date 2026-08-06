<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  deleteInvoice,
  fetchInvoiceById,
  fetchInvoicePaymentProof,
  fetchInvoicePdf,
  fetchInvoices,
  type InvoiceApprovalDocumentType,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentStatus,
  recordInvoicePayment,
  updateInvoiceStatus,
} from '@/api/invoices'
import { extractApiErrorMessage } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'

type ToastType = 'success' | 'error'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{
  search: string
  status: '' | InvoiceStatus
  paymentStatus: '' | PaymentStatus
}>({
  search: '',
  status: '',
  paymentStatus: '',
})

const selectedInvoiceId = ref('')
const paymentModalOpen = ref(false)
const paymentForm = reactive({
  amount: 0,
  method: 'BANK' as PaymentMethod,
  reference: '',
  proof: null as File | null,
})
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined
const isPreviewOpen = ref(false)
const previewUrl = ref('')
const isPreviewLoading = ref(false)
const previewError = ref('')
const statusActionInvoiceId = ref('')
const deleteActionInvoiceId = ref('')
const detailsActionInvoiceId = ref('')
const previewActionInvoiceId = ref('')
const printActionInvoiceId = ref('')
const paymentProofId = ref('')
const approvalModalOpen = ref(false)
const approvalInvoiceId = ref('')
const approvalForm = reactive({
  documentType: 'LPO' as InvoiceApprovalDocumentType,
  comments: '',
  amount: '',
  attachment: null as File | null,
})

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const invoicesQuery = useQuery({
  queryKey: computed(() => ['invoices', pagination.limit, skip.value, filters.search, filters.status, filters.paymentStatus]),
  queryFn: () =>
    fetchInvoices({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
      paymentStatus: filters.paymentStatus || undefined,
    }),
})

const invoiceDetailQuery = useQuery({
  queryKey: computed(() => ['invoice-detail', selectedInvoiceId.value]),
  queryFn: () => fetchInvoiceById(selectedInvoiceId.value),
  enabled: computed(() => selectedInvoiceId.value.length > 0),
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil((invoicesQuery.data.value?.total ?? 0) / pagination.limit)),
)
const tableRows = computed(() => invoicesQuery.data.value?.data ?? [])
const totalsCurrency = computed(() => tableRows.value[0]?.currency || 'KSH')
const tableTotals = computed(() => {
  return tableRows.value.reduce(
    (acc, invoice) => {
      acc.totalAmount += Number(invoice.totalAmount || 0)
      acc.totalPaid += Number(invoice.totalPaid || 0)
      acc.totalBalance += Number(invoice.balanceDue || 0)
      return acc
    },
    { totalAmount: 0, totalPaid: 0, totalBalance: 0 },
  )
})
const formatMoney = (value: number) =>
  `${totalsCurrency.value} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const invalidateInvoices = async () => {
  await queryClient.invalidateQueries({ queryKey: ['invoices'] })
  if (selectedInvoiceId.value) {
    await queryClient.invalidateQueries({ queryKey: ['invoice-detail', selectedInvoiceId.value] })
  }
}

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const statusMutation = useMutation({
  mutationFn: ({
    id,
    payload,
  }: {
    id: string
    payload: {
      status: InvoiceStatus
      approvalDocumentType?: InvoiceApprovalDocumentType
      approvalComments?: string
      approvalAmount?: number
      attachment?: File
    }
  }) => updateInvoiceStatus(id, payload),
  onSuccess: async () => {
    await invalidateInvoices()
    showToast('success', 'Invoice status updated successfully.')
  },
  onError: async (error) => {
    await invalidateInvoices()
    showToast('error', extractApiErrorMessage(error))
  },
})

const paymentMutation = useMutation({
  mutationFn: ({
    id,
    amount,
    method,
    reference,
    proof,
  }: {
    id: string
    amount: number
    method: PaymentMethod
    reference?: string
    proof?: File
  }) => recordInvoicePayment(id, { amount, method, reference, proof }),
  onSuccess: async () => {
    await invalidateInvoices()
    paymentModalOpen.value = false
    showToast('success', 'Payment recorded successfully.')
  },
  onError: (error) => {
    showToast('error', extractApiErrorMessage(error))
  },
})

const deleteMutation = useMutation({
  mutationFn: deleteInvoice,
  onSuccess: async () => {
    await invalidateInvoices()
    showToast('success', 'Invoice deleted successfully.')
  },
  onError: (error) => {
    showToast('error', extractApiErrorMessage(error))
  },
})

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const invoiceTone = (status: InvoiceStatus) => {
  if (status === 'APPROVED') return 'success'
  if (status === 'VOIDED' || status === 'CANCELLED') return 'danger'
  return 'warning'
}

const paymentTone = (status: PaymentStatus) => {
  if (status === 'PAID') return 'success'
  if (status === 'PARTIALLY_PAID') return 'warning'
  if (status === 'OVERDUE') return 'danger'
  return 'default'
}

const nextInvoiceStatus = (invoice: Invoice): InvoiceStatus | null => {
  if (invoice.status === 'DRAFT') return 'APPROVED'
  return null
}

const openPaymentModal = (invoice: Invoice) => {
  selectedInvoiceId.value = invoice.id
  paymentForm.amount = Number(invoice.balanceDue)
  paymentForm.method = 'BANK'
  paymentForm.reference = ''
  paymentForm.proof = null
  paymentModalOpen.value = true
}

const openDetails = (invoice: Invoice) => {
  detailsActionInvoiceId.value = invoice.id
  selectedInvoiceId.value = invoice.id
  window.setTimeout(() => {
    detailsActionInvoiceId.value = ''
  }, 500)
}

const submitPayment = async () => {
  if (!selectedInvoiceId.value || paymentForm.amount <= 0) return
  await paymentMutation.mutateAsync({
    id: selectedInvoiceId.value,
    amount: Number(paymentForm.amount),
    method: paymentForm.method,
    reference: paymentForm.reference || undefined,
    proof: paymentForm.proof ?? undefined,
  })
}

const onPaymentProofChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  paymentForm.proof = input.files?.[0] ?? null
}

const viewPaymentProof = async (paymentId: string) => {
  paymentProofId.value = paymentId
  try {
    const blob = await fetchInvoicePaymentProof(paymentId)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    paymentProofId.value = ''
  }
}

const openApprovalModal = (invoice: Invoice) => {
  approvalInvoiceId.value = invoice.id
  approvalForm.documentType = 'LPO'
  approvalForm.comments = ''
  approvalForm.amount = ''
  approvalForm.attachment = null
  approvalModalOpen.value = true
}

const closeApprovalModal = () => {
  if (statusMutation.isPending.value) return
  approvalModalOpen.value = false
  approvalInvoiceId.value = ''
}

const onApprovalAttachmentChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  approvalForm.attachment = input.files?.[0] ?? null
}

const submitApproval = async () => {
  if (!approvalInvoiceId.value) return
  if (!approvalForm.comments.trim()) {
    showToast('error', 'Comments are required before approval.')
    return
  }
  if (!approvalForm.attachment) {
    showToast('error', 'Attachment is required before approval.')
    return
  }
  statusActionInvoiceId.value = approvalInvoiceId.value
  try {
    await statusMutation.mutateAsync({
      id: approvalInvoiceId.value,
      payload: {
        status: 'APPROVED',
        approvalDocumentType: approvalForm.documentType,
        approvalComments: approvalForm.comments.trim(),
        approvalAmount: approvalForm.amount ? Number(approvalForm.amount) : undefined,
        attachment: approvalForm.attachment,
      },
    })
    approvalModalOpen.value = false
    approvalInvoiceId.value = ''
  } finally {
    statusActionInvoiceId.value = ''
  }
}

const handleDeleteInvoice = async (invoiceId: string) => {
  deleteActionInvoiceId.value = invoiceId
  try {
    await deleteMutation.mutateAsync(invoiceId)
  } finally {
    deleteActionInvoiceId.value = ''
  }
}

const printInvoicePdf = async (invoiceId: string) => {
  printActionInvoiceId.value = invoiceId
  try {
    const blob = await fetchInvoicePdf(invoiceId)
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')

    if (win) {
      win.onload = () => win.print()
      showToast('success', 'Invoice PDF generated. Print dialog opened.')
    } else {
      showToast('error', 'Popup blocked. Allow popups to print the PDF.')
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    printActionInvoiceId.value = ''
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

const openPreview = async (invoiceId: string) => {
  previewActionInvoiceId.value = invoiceId
  closePreview()
  isPreviewOpen.value = true
  isPreviewLoading.value = true
  try {
    const blob = await fetchInvoicePdf(invoiceId)
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    previewError.value = extractApiErrorMessage(error, 'Failed to load invoice preview.')
  } finally {
    isPreviewLoading.value = false
    previewActionInvoiceId.value = ''
  }
}
</script>

<template>
  <section class="space-y-4">
    <header>
      <h3 class="text-xl font-semibold">Tax Invoices</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">Track invoice approvals, partial payments, balances, and payment history.</p>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search invoice/proforma/customer..." type="search" />
        <select v-model="filters.status" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All invoice statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="VOIDED">Voided</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select v-model="filters.paymentStatus" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All payment statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      <div v-if="invoicesQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading invoices...</div>
      <div v-else-if="invoicesQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load invoices.</div>
      <div v-else-if="(invoicesQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No invoices found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Invoice #</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Paid</th>
              <th class="px-3 py-2">Balance</th>
              <th class="px-3 py-2">Invoice Status</th>
              <th class="px-3 py-2">Payment Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invoice in invoicesQuery.data.value?.data ?? []" :key="invoice.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ invoice.invoiceNumber }}</td>
              <td class="px-3 py-3">{{ invoice.customer?.companyName ?? '-' }}</td>
              <td class="px-3 py-3">{{ invoice.totalAmount }} {{ invoice.currency || 'KSH' }}</td>
              <td class="px-3 py-3">{{ invoice.totalPaid }}</td>
              <td class="px-3 py-3">{{ invoice.balanceDue }}</td>
              <td class="px-3 py-3"><StatusBadge :label="invoice.status" :tone="invoiceTone(invoice.status)" /></td>
              <td class="px-3 py-3"><StatusBadge :label="invoice.paymentStatus" :tone="paymentTone(invoice.paymentStatus)" /></td>
              <td class="px-3 py-3 text-right space-x-2">
                <button
                  v-if="nextInvoiceStatus(invoice)"
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  :disabled="statusMutation.isPending.value || statusActionInvoiceId === invoice.id"
                  @click="openApprovalModal(invoice)"
                >
                  {{ statusActionInvoiceId === invoice.id ? 'Updating...' : 'Approve' }}
                </button>
                <button
                  v-if="invoice.paymentStatus !== 'PAID' && invoice.status === 'APPROVED'"
                  class="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-700"
                  :disabled="paymentMutation.isPending.value"
                  @click="openPaymentModal(invoice)"
                >
                  Record Payment
                </button>
                <button
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  :disabled="detailsActionInvoiceId === invoice.id || invoiceDetailQuery.isFetching.value"
                  @click="openDetails(invoice)"
                >
                  {{ detailsActionInvoiceId === invoice.id ? 'Loading...' : 'Details' }}
                </button>
                <button
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  :disabled="previewActionInvoiceId === invoice.id || isPreviewLoading"
                  @click="openPreview(invoice.id)"
                >
                  {{ previewActionInvoiceId === invoice.id ? 'Loading...' : 'Preview' }}
                </button>
                <button
                  class="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700"
                  :disabled="printActionInvoiceId === invoice.id"
                  @click="printInvoicePdf(invoice.id)"
                >
                  {{ printActionInvoiceId === invoice.id ? 'Generating...' : 'PDF / Print' }}
                </button>
                <button
                  v-if="invoice.status !== 'APPROVED'"
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  :disabled="deleteMutation.isPending.value || deleteActionInvoiceId === invoice.id"
                  @click="handleDeleteInvoice(invoice.id)"
                >
                  {{ deleteActionInvoiceId === invoice.id ? 'Deleting...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="tableRows.length > 0"
        class="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/50"
      >
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Invoices Total (Shown)</p>
          <p class="font-semibold">{{ formatMoney(tableTotals.totalAmount) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Paid Total (Shown)</p>
          <p class="font-semibold text-emerald-700 dark:text-emerald-400">{{ formatMoney(tableTotals.totalPaid) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Balance Total (Shown)</p>
          <p class="font-semibold text-amber-700 dark:text-amber-400">{{ formatMoney(tableTotals.totalBalance) }}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ invoicesQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div v-if="selectedInvoiceId && invoiceDetailQuery.data.value" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h4 class="mb-3 text-lg font-semibold">
        Payment History - {{ invoiceDetailQuery.data.value.invoiceNumber }}
      </h4>
      <div v-if="(invoiceDetailQuery.data.value.payments?.length ?? 0) === 0" class="text-sm text-slate-500">
        No payments recorded.
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="payment in invoiceDetailQuery.data.value.payments ?? []"
          :key="payment.id"
          class="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
        >
          <div class="flex items-center justify-between">
            <span>{{ payment.paymentNumber }} - {{ payment.method }}</span>
            <span>{{ payment.amount }}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ new Date(payment.paidAt).toLocaleString() }} {{ payment.reference ? `• Ref: ${payment.reference}` : '' }}
          </p>
          <button
            v-if="payment.receiptPath"
            class="mt-2 rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700"
            :disabled="paymentProofId === payment.id"
            @click="viewPaymentProof(payment.id)"
          >
            {{ paymentProofId === payment.id ? 'Opening...' : 'View Proof' }}
          </button>
        </li>
      </ul>
    </div>

    <div v-if="paymentModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">Record Payment</h4>
          <button class="text-sm text-slate-500" :disabled="paymentMutation.isPending.value" @click="paymentModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3" @submit.prevent="submitPayment">
          <input v-model.number="paymentForm.amount" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="number" min="0.01" step="0.01" placeholder="Amount" />
          <select v-model="paymentForm.method" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="CHEQUE">Cheque</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CARD">Card</option>
          </select>
          <input v-model="paymentForm.reference" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Reference (optional)" />
          <input
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 dark:border-slate-700 dark:bg-slate-900 dark:file:bg-slate-800"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            @change="onPaymentProofChange"
          />
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" :disabled="paymentMutation.isPending.value" @click="paymentModalOpen = false">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="paymentMutation.isPending.value">
              {{ paymentMutation.isPending.value ? 'Saving...' : 'Save Payment' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="approvalModalOpen" class="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">Approve Invoice</h4>
          <button class="text-sm text-slate-500" :disabled="statusMutation.isPending.value" @click="closeApprovalModal">Close</button>
        </div>
        <form class="grid gap-3" @submit.prevent="submitApproval">
          <select v-model="approvalForm.documentType" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="LPO">Local Purchase Order (LPO)</option>
            <option value="DELIVERY_NOTE">Delivery Note</option>
          </select>
          <textarea
            v-model="approvalForm.comments"
            class="min-h-[90px] rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Comments (required)"
          />
          <input
            v-model="approvalForm.amount"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount (optional)"
          />
          <input
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 dark:border-slate-700 dark:bg-slate-900 dark:file:bg-slate-800"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,.doc,.docx"
            @change="onApprovalAttachmentChange"
          />
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" :disabled="statusMutation.isPending.value" @click="closeApprovalModal">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="statusMutation.isPending.value">
              {{ statusMutation.isPending.value ? 'Approving...' : 'Approve Invoice' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="isPreviewOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div class="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-3 flex items-center justify-between">
          <h4 class="text-base font-semibold">Invoice Preview</h4>
          <button class="text-sm text-slate-500" :disabled="isPreviewLoading" @click="closePreview">Close</button>
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
