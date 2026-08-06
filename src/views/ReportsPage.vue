<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  exportSalesReportExcel,
  fetchEmailReport,
  fetchReportsOverview,
  fetchSalesReport,
} from '@/api/reports'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { extractApiErrorMessage } from '@/lib/api'

type ToastType = 'success' | 'error'

const filters = reactive({
  fromDate: '',
  toDate: '',
  search: '',
  status: '' as '' | 'DRAFT' | 'APPROVED' | 'VOIDED' | 'CANCELLED',
  paymentStatus: '' as '' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE',
})

const salesPagination = reactive({ page: 1, limit: 10 })
const emailPagination = reactive({ page: 1, limit: 20 })
const emailFilters = reactive<{ search: string; status: '' | 'SUCCESS' | 'FAILED' }>({
  search: '',
  status: '',
})

const salesSkip = computed(() => (salesPagination.page - 1) * salesPagination.limit)
const emailSkip = computed(() => (emailPagination.page - 1) * emailPagination.limit)
const exportLoading = ref(false)
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined

const sharedReportFilters = computed(() => ({
  fromDate: filters.fromDate || undefined,
  toDate: filters.toDate || undefined,
  search: filters.search || undefined,
  status: filters.status || undefined,
  paymentStatus: filters.paymentStatus || undefined,
}))

const overviewQuery = useQuery({
  queryKey: computed(() => ['reports-overview', sharedReportFilters.value]),
  queryFn: () => fetchReportsOverview(sharedReportFilters.value),
})

const salesQuery = useQuery({
  queryKey: computed(() => ['reports-sales', salesPagination.limit, salesSkip.value, sharedReportFilters.value]),
  queryFn: () =>
    fetchSalesReport({
      ...sharedReportFilters.value,
      limit: salesPagination.limit,
      skip: salesSkip.value,
    }),
})

const emailQuery = useQuery({
  queryKey: computed(() => ['reports-email', emailPagination.limit, emailSkip.value, emailFilters.search, emailFilters.status]),
  queryFn: () =>
    fetchEmailReport({
      limit: emailPagination.limit,
      skip: emailSkip.value,
      search: emailFilters.search || undefined,
      status: emailFilters.status || undefined,
    }),
})

const salesTotalPages = computed(() => Math.max(1, Math.ceil((salesQuery.data.value?.total ?? 0) / salesPagination.limit)))
const emailTotalPages = computed(() => Math.max(1, Math.ceil((emailQuery.data.value?.total ?? 0) / emailPagination.limit)))
const currency = computed(() => salesQuery.data.value?.data[0]?.currency ?? 'KSH')

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const setSalesPage = (value: number) => {
  if (value < 1 || value > salesTotalPages.value) return
  salesPagination.page = value
}

const setEmailPage = (value: number) => {
  if (value < 1 || value > emailTotalPages.value) return
  emailPagination.page = value
}

const exportSalesExcel = async () => {
  exportLoading.value = true
  try {
    const blob = await exportSalesReportExcel({
      ...sharedReportFilters.value,
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    showToast('success', 'Sales report exported to Excel.')
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    exportLoading.value = false
  }
}
</script>

<template>
  <section class="space-y-4">
    <header>
      <h3 class="text-xl font-semibold">Reports</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">Sales analytics, invoice report, and email dispatch tracking.</p>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="flex flex-wrap items-end gap-2">
        <label class="text-xs text-slate-500 dark:text-slate-400">
          From
          <input v-model="filters.fromDate" type="date" class="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <label class="text-xs text-slate-500 dark:text-slate-400">
          To
          <input v-model="filters.toDate" type="date" class="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search invoice/customer..." type="search" />
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
        <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700" :disabled="exportLoading" @click="exportSalesExcel">
          {{ exportLoading ? 'Exporting...' : 'Export Sales Excel' }}
        </button>
      </div>
    </div>

    <div v-if="overviewQuery.isLoading.value" class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      Loading report overview...
    </div>
    <div v-else-if="overviewQuery.isError.value" class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-rose-600 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      Failed to load report overview.
    </div>
    <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p class="text-xs text-slate-500 dark:text-slate-400">Quotations</p>
        <p class="mt-1 text-lg font-semibold">{{ overviewQuery.data.value?.cards.quotationsCount ?? 0 }}</p>
        <p class="text-xs text-slate-500">Accepted: {{ overviewQuery.data.value?.cards.quotationsAccepted ?? 0 }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p class="text-xs text-slate-500 dark:text-slate-400">Invoice Amount</p>
        <p class="mt-1 text-lg font-semibold">{{ currency }} {{ (overviewQuery.data.value?.cards.invoiceAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p class="text-xs text-slate-500 dark:text-slate-400">Payments Received</p>
        <p class="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-400">{{ currency }} {{ (overviewQuery.data.value?.cards.paymentsAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p class="text-xs text-slate-500 dark:text-slate-400">Outstanding</p>
        <p class="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-400">{{ currency }} {{ (overviewQuery.data.value?.cards.outstandingAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p class="text-xs text-slate-500 dark:text-slate-400">Pending Deliveries</p>
        <p class="mt-1 text-lg font-semibold">{{ overviewQuery.data.value?.cards.pendingDeliveries ?? 0 }}</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h4 class="mb-2 text-base font-semibold">Top Customers</h4>
        <div v-if="(overviewQuery.data.value?.topCustomers.length ?? 0) === 0" class="py-4 text-sm text-slate-500">No customer sales data.</div>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="row in overviewQuery.data.value?.topCustomers ?? []" :key="row.customerId" class="flex items-center justify-between rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
            <span>{{ row.customerName }}</span>
            <span class="font-semibold">{{ currency }} {{ row.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h4 class="mb-2 text-base font-semibold">Top Products</h4>
        <div v-if="(overviewQuery.data.value?.topProducts.length ?? 0) === 0" class="py-4 text-sm text-slate-500">No product sales data.</div>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="row in overviewQuery.data.value?.topProducts ?? []" :key="row.productId" class="rounded border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <span>{{ row.productName }}</span>
              <span class="font-semibold">{{ currency }} {{ row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <p class="text-xs text-slate-500">Qty: {{ row.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) }} • SKU: {{ row.sku || '-' }}</p>
          </li>
        </ul>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h4 class="mb-3 text-base font-semibold">Sales Invoices</h4>
      <div v-if="salesQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading sales report...</div>
      <div v-else-if="salesQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load sales report.</div>
      <div v-else-if="(salesQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No invoice records found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Invoice</th>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Paid</th>
              <th class="px-3 py-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in salesQuery.data.value?.data ?? []" :key="row.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ row.invoiceNumber }}</td>
              <td class="px-3 py-3">{{ new Date(row.issueDate).toLocaleDateString() }}</td>
              <td class="px-3 py-3">{{ row.customer?.companyName ?? '-' }}</td>
              <td class="px-3 py-3">
                <div class="flex gap-2">
                  <StatusBadge :label="row.status" :tone="row.status === 'APPROVED' ? 'success' : row.status === 'DRAFT' ? 'warning' : 'danger'" />
                  <StatusBadge :label="row.paymentStatus" :tone="row.paymentStatus === 'PAID' ? 'success' : row.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'danger'" />
                </div>
              </td>
              <td class="px-3 py-3">{{ row.currency }} {{ Number(row.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
              <td class="px-3 py-3 text-emerald-700 dark:text-emerald-400">{{ row.currency }} {{ Number(row.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
              <td class="px-3 py-3 text-amber-700 dark:text-amber-400">{{ row.currency }} {{ Number(row.balanceDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="salesQuery.data.value" class="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/50">
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Sales Total</p>
          <p class="font-semibold">{{ currency }} {{ salesQuery.data.value.totals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Tax Total</p>
          <p class="font-semibold text-amber-700 dark:text-amber-400">{{ currency }} {{ salesQuery.data.value.totals.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p class="text-slate-500 dark:text-slate-400">Outstanding</p>
          <p class="font-semibold text-rose-700 dark:text-rose-400">{{ currency }} {{ salesQuery.data.value.totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ salesQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setSalesPage(salesPagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ salesPagination.page }} / {{ salesTotalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setSalesPage(salesPagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h4 class="mb-3 text-base font-semibold">Email Dispatch Report</h4>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="emailFilters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search quotation, recipient, message..." type="search" />
        <select v-model="emailFilters.status" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div v-if="emailQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading email report...</div>
      <div v-else-if="emailQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load email report.</div>
      <div v-else-if="(emailQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No email records found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Quotation</th>
              <th class="px-3 py-2">Recipient</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in emailQuery.data.value?.data ?? []" :key="entry.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ new Date(entry.createdAt).toLocaleString() }}</td>
              <td class="px-3 py-3">{{ entry.quotationNumber ?? entry.quotationId ?? '-' }}</td>
              <td class="px-3 py-3">{{ entry.recipient ?? '-' }}</td>
              <td class="px-3 py-3">
                <StatusBadge :label="entry.status" :tone="entry.status === 'SUCCESS' ? 'success' : 'danger'" />
              </td>
              <td class="px-3 py-3">{{ entry.error ?? entry.message ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ emailQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setEmailPage(emailPagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ emailPagination.page }} / {{ emailTotalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setEmailPage(emailPagination.page + 1)">Next</button>
        </div>
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
