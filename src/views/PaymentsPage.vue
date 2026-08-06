<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchInvoices } from '@/api/invoices'
import { fetchProformas } from '@/api/proformas'
import {
  createPayment,
  exportPaymentsExcel,
  fetchPaymentStatement,
  fetchPaymentProof,
  fetchPayments,
  reversePayment,
  type PaymentStatement,
  type PaymentMethod,
} from '@/api/payments'
import { extractApiErrorMessage } from '@/lib/api'

type ToastType = 'success' | 'error'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{
  search: string
  method: '' | PaymentMethod
}>({
  search: '',
  method: '',
})
const createModalOpen = ref(false)
const createForm = reactive({
  sourceType: 'INVOICE' as 'INVOICE' | 'PROFORMA',
  sourceId: '',
  amount: '',
  method: 'BANK' as PaymentMethod,
  reference: '',
  paidAt: '',
  notes: '',
  proof: null as File | null,
})
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined
const createPending = ref(false)
const proofActionPaymentId = ref('')
const reverseActionPaymentId = ref('')
const statementForm = reactive({
  fromDate: '',
  toDate: '',
})
const statementResult = ref<PaymentStatement | null>(null)
const statementLoading = ref(false)
const exportLoading = ref(false)

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const paymentsQuery = useQuery({
  queryKey: computed(() => ['payments', pagination.limit, skip.value, filters.search, filters.method]),
  queryFn: () =>
    fetchPayments({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      method: filters.method || undefined,
    }),
})

const approvedInvoicesQuery = useQuery({
  queryKey: ['payments-approved-invoices'],
  queryFn: () =>
    fetchInvoices({
      limit: 300,
      skip: 0,
      status: 'APPROVED',
    }),
})

const approvedProformasQuery = useQuery({
  queryKey: ['payments-approved-proformas'],
  queryFn: () =>
    fetchProformas({
      limit: 300,
      skip: 0,
      status: 'APPROVED',
    }),
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil((paymentsQuery.data.value?.total ?? 0) / pagination.limit)),
)

const tableRows = computed(() => paymentsQuery.data.value?.data ?? [])
const totalsCurrency = computed(() => {
  const invoiceCurrency = approvedInvoicesQuery.data.value?.data.find((i) => i.id === createForm.sourceId)?.currency
  return invoiceCurrency || 'KSH'
})
const paymentsTotal = computed(() =>
  tableRows.value.reduce((sum, row) => sum + Number(row.amount || 0), 0),
)
const taxTotal = computed(() =>
  tableRows.value.reduce((sum, row) => {
    const paymentAmount = Number(row.amount || 0)
    const sourceTotal = Number(row.invoice?.totalAmount ?? row.proforma?.totalAmount ?? 0)
    const sourceTax = Number(row.invoice?.taxAmount ?? row.proforma?.taxAmount ?? 0)
    if (sourceTotal <= 0 || sourceTax <= 0 || paymentAmount <= 0) return sum
    const taxRatio = sourceTax / sourceTotal
    const paymentTax = paymentAmount * taxRatio
    return sum + paymentTax
  }, 0),
)
const netTotal = computed(() => Math.max(paymentsTotal.value - taxTotal.value, 0))

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const invalidatePayments = async () => {
  await queryClient.invalidateQueries({ queryKey: ['payments'] })
  await queryClient.invalidateQueries({ queryKey: ['invoices'] })
}

const createMutation = useMutation({
  mutationFn: createPayment,
  onSuccess: async () => {
    await invalidatePayments()
    createModalOpen.value = false
    showToast('success', 'Payment recorded successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const reverseMutation = useMutation({
  mutationFn: reversePayment,
  onSuccess: async () => {
    await invalidatePayments()
    showToast('success', 'Payment reversed successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const openCreateModal = () => {
  createForm.sourceType = 'INVOICE'
  createForm.sourceId = ''
  createForm.amount = ''
  createForm.method = 'BANK'
  createForm.reference = ''
  createForm.paidAt = ''
  createForm.notes = ''
  createForm.proof = null
  createModalOpen.value = true
}

const sourceOptions = computed(() => {
  if (createForm.sourceType === 'INVOICE') {
    return (approvedInvoicesQuery.data.value?.data ?? []).map((x) => ({
      id: x.id,
      label: `${x.invoiceNumber} - ${x.customer?.companyName ?? '-'}`,
    }))
  }
  return (approvedProformasQuery.data.value?.data ?? []).map((x) => ({
    id: x.id,
    label: `${x.proformaNumber} - ${x.customer?.companyName ?? '-'}`,
  }))
})

const onProofFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  createForm.proof = input.files?.[0] ?? null
}

const submitCreate = async () => {
  if (!createForm.sourceId) {
    showToast('error', `${createForm.sourceType === 'INVOICE' ? 'Invoice' : 'Proforma'} is required.`)
    return
  }
  if (!createForm.amount || Number(createForm.amount) <= 0) {
    showToast('error', 'Amount must be greater than zero.')
    return
  }
  createPending.value = true
  try {
    await createMutation.mutateAsync({
      invoiceId: createForm.sourceType === 'INVOICE' ? createForm.sourceId : undefined,
      proformaId: createForm.sourceType === 'PROFORMA' ? createForm.sourceId : undefined,
      amount: Number(createForm.amount),
      method: createForm.method,
      reference: createForm.reference || undefined,
      paidAt: createForm.paidAt || undefined,
      notes: createForm.notes || undefined,
      proof: createForm.proof ?? undefined,
    })
  } finally {
    createPending.value = false
  }
}

const viewProof = async (paymentId: string) => {
  proofActionPaymentId.value = paymentId
  try {
    const blob = await fetchPaymentProof(paymentId)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    proofActionPaymentId.value = ''
  }
}

const reversePaymentRow = async (paymentId: string) => {
  reverseActionPaymentId.value = paymentId
  try {
    await reverseMutation.mutateAsync(paymentId)
  } finally {
    reverseActionPaymentId.value = ''
  }
}

const generateStatement = async () => {
  if (!statementForm.fromDate || !statementForm.toDate) {
    showToast('error', 'Statement date range is required.')
    return
  }
  const fromDate = new Date(statementForm.fromDate)
  const toDate = new Date(statementForm.toDate)
  if (fromDate > toDate) {
    showToast('error', 'From date cannot be after to date.')
    return
  }
  const maxToDate = new Date(fromDate)
  maxToDate.setMonth(maxToDate.getMonth() + 6)
  if (toDate > maxToDate) {
    showToast('error', 'Date range cannot exceed 6 months.')
    return
  }

  statementLoading.value = true
  try {
    statementResult.value = await fetchPaymentStatement({
      fromDate: statementForm.fromDate,
      toDate: statementForm.toDate,
    })
    showToast('success', 'Statement generated.')
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    statementLoading.value = false
  }
}

const exportExcel = async () => {
  exportLoading.value = true
  try {
    const blob = await exportPaymentsExcel({
      search: filters.search || undefined,
      method: filters.method || undefined,
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payments-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    showToast('success', 'Payments exported to Excel.')
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    exportLoading.value = false
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-semibold">Payments</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Record and track invoice/proforma payments with proof attachments.</p>
      </div>
      <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="openCreateModal">
        Record Payment
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search payment/customer/invoice/proforma..." type="search" />
        <select v-model="filters.method" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All methods</option>
          <option value="CASH">Cash</option>
          <option value="BANK">Bank</option>
          <option value="CHEQUE">Cheque</option>
          <option value="MOBILE_MONEY">Mobile Money</option>
          <option value="CARD">Card</option>
        </select>
        <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700" :disabled="exportLoading" @click="exportExcel">
          {{ exportLoading ? 'Exporting...' : 'Export Excel' }}
        </button>
      </div>

      <div v-if="paymentsQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading payments...</div>
      <div v-else-if="paymentsQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load payments.</div>
      <div v-else-if="(paymentsQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No payments found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Payment #</th>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Source</th>
              <th class="px-3 py-2">Method</th>
              <th class="px-3 py-2">Amount</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in paymentsQuery.data.value?.data ?? []" :key="payment.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ payment.paymentNumber }}</td>
              <td class="px-3 py-3">{{ new Date(payment.paidAt).toLocaleString() }}</td>
              <td class="px-3 py-3">{{ payment.customer?.companyName ?? '-' }}</td>
              <td class="px-3 py-3">
                <span v-if="payment.invoice">Invoice {{ payment.invoice.invoiceNumber }}</span>
                <span v-else-if="payment.proforma">Proforma {{ payment.proforma.proformaNumber }}</span>
                <span v-else>-</span>
              </td>
              <td class="px-3 py-3">{{ payment.method }}</td>
              <td class="px-3 py-3">{{ payment.amount }}</td>
              <td class="px-3 py-3 text-right space-x-2">
                <button
                  v-if="payment.receiptPath"
                  class="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700"
                  :disabled="proofActionPaymentId === payment.id"
                  @click="viewProof(payment.id)"
                >
                  {{ proofActionPaymentId === payment.id ? 'Opening...' : 'View Proof' }}
                </button>
                <button
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  :disabled="reverseMutation.isPending.value || reverseActionPaymentId === payment.id"
                  @click="reversePaymentRow(payment.id)"
                >
                  {{ reverseActionPaymentId === payment.id ? 'Reversing...' : 'Reverse' }}
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
          <p class="text-slate-500 dark:text-slate-400">Payments Total (Shown)</p>
          <p class="font-semibold">{{ totalsCurrency }} {{ paymentsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Tax Total (Shown)</p>
          <p class="font-semibold text-amber-700 dark:text-amber-400">{{ totalsCurrency }} {{ taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Net Total (Shown)</p>
          <p class="font-semibold text-emerald-700 dark:text-emerald-400">{{ totalsCurrency }} {{ netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ paymentsQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h4 class="mb-3 text-base font-semibold">Payment Statement</h4>
      <div class="flex flex-wrap items-end gap-2">
        <label class="text-xs text-slate-500 dark:text-slate-400">
          From Date
          <input v-model="statementForm.fromDate" class="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" />
        </label>
        <label class="text-xs text-slate-500 dark:text-slate-400">
          To Date
          <input v-model="statementForm.toDate" class="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" />
        </label>
        <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" :disabled="statementLoading" @click="generateStatement">
          {{ statementLoading ? 'Generating...' : 'Generate Statement' }}
        </button>
      </div>
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Maximum allowed range is 6 months.</p>

      <div v-if="statementResult" class="mt-4 space-y-3">
        <div class="grid gap-2 text-xs sm:grid-cols-3">
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
            <p class="text-slate-500 dark:text-slate-400">Gross Total</p>
            <p class="font-semibold">{{ totalsCurrency }} {{ statementResult.totals.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
            <p class="text-slate-500 dark:text-slate-400">Tax Total</p>
            <p class="font-semibold text-amber-700 dark:text-amber-400">{{ totalsCurrency }} {{ statementResult.totals.taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
            <p class="text-slate-500 dark:text-slate-400">Net Total</p>
            <p class="font-semibold text-emerald-700 dark:text-emerald-400">{{ totalsCurrency }} {{ statementResult.totals.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
          </div>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">Records: {{ statementResult.count }}</p>
      </div>
    </div>

    <div v-if="createModalOpen" class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">Record Payment</h4>
          <button class="text-sm text-slate-500" :disabled="createPending" @click="createModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3" @submit.prevent="submitCreate">
          <select v-model="createForm.sourceType" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="INVOICE">Invoice</option>
            <option value="PROFORMA">Proforma</option>
          </select>
          <select v-model="createForm.sourceId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Select {{ createForm.sourceType === 'INVOICE' ? 'invoice' : 'proforma' }}</option>
            <option v-for="option in sourceOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
          <input v-model="createForm.amount" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="number" min="0.01" step="0.01" placeholder="Amount" />
          <select v-model="createForm.method" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="CHEQUE">Cheque</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CARD">Card</option>
          </select>
          <input v-model="createForm.reference" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Reference (optional)" />
          <input v-model="createForm.paidAt" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="datetime-local" />
          <textarea v-model="createForm.notes" class="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Notes (optional)" />
          <input
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 dark:border-slate-700 dark:bg-slate-900 dark:file:bg-slate-800"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            @change="onProofFileChange"
          />
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" :disabled="createPending" @click="createModalOpen = false">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="createPending">
              {{ createPending ? 'Saving...' : 'Save Payment' }}
            </button>
          </div>
        </form>
      </div>
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
