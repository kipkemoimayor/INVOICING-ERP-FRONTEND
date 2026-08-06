<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createDeliveryNote,
  fetchDeliveryNoteAttachment,
  fetchDeliveryNotes,
  type DeliveryNote,
  type DeliveryStatus,
  updateDeliveryNoteStatus,
} from '@/api/delivery-notes'
import { fetchInvoices } from '@/api/invoices'
import { extractApiErrorMessage } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'

type ToastType = 'success' | 'error'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{ search: string; status: '' | DeliveryStatus }>({
  search: '',
  status: '',
})
const createModalOpen = ref(false)
const createForm = reactive({
  invoiceId: '',
  dispatchDate: '',
  receiver: '',
  comments: '',
  amount: '',
  attachment: null as File | null,
})
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined
const statusActionDeliveryId = ref('')
const attachmentActionDeliveryId = ref('')

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const deliveryNotesQuery = useQuery({
  queryKey: computed(() => ['delivery-notes', pagination.limit, skip.value, filters.search, filters.status]),
  queryFn: () =>
    fetchDeliveryNotes({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
    }),
})

const approvedInvoicesQuery = useQuery({
  queryKey: ['delivery-note-approved-invoices'],
  queryFn: () =>
    fetchInvoices({
      limit: 200,
      skip: 0,
      status: 'APPROVED',
    }),
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil((deliveryNotesQuery.data.value?.total ?? 0) / pagination.limit)),
)

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const invalidateDeliveryNotes = async () => {
  await queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
}

const createMutation = useMutation({
  mutationFn: createDeliveryNote,
  onSuccess: async () => {
    await invalidateDeliveryNotes()
    createModalOpen.value = false
    showToast('success', 'Delivery note created successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) => updateDeliveryNoteStatus(id, status),
  onSuccess: async () => {
    await invalidateDeliveryNotes()
    showToast('success', 'Delivery note status updated.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const nextStatus = (note: DeliveryNote): DeliveryStatus | null => {
  if (note.status === 'PENDING') return 'DISPATCHED'
  if (note.status === 'DISPATCHED') return 'DELIVERED'
  return null
}

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const openCreateModal = () => {
  createForm.invoiceId = ''
  createForm.dispatchDate = ''
  createForm.receiver = ''
  createForm.comments = ''
  createForm.amount = ''
  createForm.attachment = null
  createModalOpen.value = true
}

const onCreateAttachmentChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  createForm.attachment = input.files?.[0] ?? null
}

const submitCreate = async () => {
  if (!createForm.invoiceId) {
    showToast('error', 'Invoice is required.')
    return
  }
  if (!createForm.comments.trim()) {
    showToast('error', 'Comments are required.')
    return
  }
  if (!createForm.attachment) {
    showToast('error', 'Attachment is required.')
    return
  }

  await createMutation.mutateAsync({
    invoiceId: createForm.invoiceId,
    dispatchDate: createForm.dispatchDate || undefined,
    receiver: createForm.receiver || undefined,
    comments: createForm.comments.trim(),
    amount: createForm.amount ? Number(createForm.amount) : undefined,
    attachment: createForm.attachment,
  })
}

const handleUpdateStatus = async (noteId: string, status: DeliveryStatus) => {
  statusActionDeliveryId.value = noteId
  try {
    await statusMutation.mutateAsync({ id: noteId, status })
  } finally {
    statusActionDeliveryId.value = ''
  }
}

const viewAttachment = async (noteId: string) => {
  attachmentActionDeliveryId.value = noteId
  try {
    const blob = await fetchDeliveryNoteAttachment(noteId)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    showToast('error', extractApiErrorMessage(error))
  } finally {
    attachmentActionDeliveryId.value = ''
  }
}

const badgeTone = (status: DeliveryStatus) => {
  if (status === 'DELIVERED') return 'success'
  if (status === 'RETURNED') return 'danger'
  if (status === 'DISPATCHED') return 'warning'
  return 'default'
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-semibold">Delivery Notes</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Delivery notes can be auto-created from invoice approval or added manually here.
        </p>
      </div>
      <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="openCreateModal">
        Add Delivery Note
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search delivery/customer/invoice..." type="search" />
        <select v-model="filters.status" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="DELIVERED">Delivered</option>
          <option value="RETURNED">Returned</option>
        </select>
      </div>

      <div v-if="deliveryNotesQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading delivery notes...</div>
      <div v-else-if="deliveryNotesQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load delivery notes.</div>
      <div v-else-if="(deliveryNotesQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No delivery notes found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Delivery #</th>
              <th class="px-3 py-2">Invoice #</th>
              <th class="px-3 py-2">Customer</th>
              <th class="px-3 py-2">Dispatch Date</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="note in deliveryNotesQuery.data.value?.data ?? []" :key="note.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ note.deliveryNumber }}</td>
              <td class="px-3 py-3">{{ note.invoice?.invoiceNumber ?? '-' }}</td>
              <td class="px-3 py-3">{{ note.customer?.companyName ?? '-' }}</td>
              <td class="px-3 py-3">{{ note.dispatchDate ? new Date(note.dispatchDate).toLocaleDateString() : '-' }}</td>
              <td class="px-3 py-3"><StatusBadge :label="note.status" :tone="badgeTone(note.status)" /></td>
              <td class="px-3 py-3 text-right space-x-2">
                <button
                  v-if="nextStatus(note)"
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  :disabled="statusMutation.isPending.value || statusActionDeliveryId === note.id"
                  @click="handleUpdateStatus(note.id, nextStatus(note)!)"
                >
                  {{ statusActionDeliveryId === note.id ? 'Updating...' : `Mark ${nextStatus(note)}` }}
                </button>
                <button
                  class="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700"
                  :disabled="attachmentActionDeliveryId === note.id"
                  @click="viewAttachment(note.id)"
                >
                  {{ attachmentActionDeliveryId === note.id ? 'Opening...' : 'View Attachment' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ deliveryNotesQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div v-if="createModalOpen" class="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">Create Delivery Note</h4>
          <button class="text-sm text-slate-500" :disabled="createMutation.isPending.value" @click="createModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3" @submit.prevent="submitCreate">
          <select v-model="createForm.invoiceId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Select approved invoice</option>
            <option v-for="invoice in approvedInvoicesQuery.data.value?.data ?? []" :key="invoice.id" :value="invoice.id">
              {{ invoice.invoiceNumber }} - {{ invoice.customer?.companyName ?? '-' }}
            </option>
          </select>
          <input v-model="createForm.dispatchDate" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="date" />
          <input v-model="createForm.receiver" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Receiver (optional)" />
          <textarea v-model="createForm.comments" class="min-h-[90px] rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Comments (required)" />
          <input v-model="createForm.amount" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" type="number" min="0" step="0.01" placeholder="Amount (optional)" />
          <input
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 dark:border-slate-700 dark:bg-slate-900 dark:file:bg-slate-800"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,.doc,.docx"
            @change="onCreateAttachmentChange"
          />
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" :disabled="createMutation.isPending.value" @click="createModalOpen = false">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="createMutation.isPending.value">
              {{ createMutation.isPending.value ? 'Saving...' : 'Save Delivery Note' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="toast"
      class="fixed right-4 top-4 z-[75] rounded-lg px-4 py-3 text-sm shadow-lg"
      :class="toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
    >
      {{ toast.message }}
    </div>
  </section>
</template>
