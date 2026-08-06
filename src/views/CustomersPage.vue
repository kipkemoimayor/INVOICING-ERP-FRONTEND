<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  type Customer,
  type CustomerStatus,
  updateCustomer,
  type UpsertCustomerPayload,
} from '@/api/customers'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const queryClient = useQueryClient()

const pagination = reactive({
  page: 1,
  limit: 10,
})

const filters = reactive<{
  search: string
  status: '' | CustomerStatus
}>({
  search: '',
  status: '',
})

const form = reactive<UpsertCustomerPayload>({
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  taxNumber: '',
  status: 'ACTIVE',
})

const isModalOpen = ref(false)
const editingCustomer = ref<Customer | null>(null)

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const customersQuery = useQuery({
  queryKey: computed(() => [
    'customers',
    pagination.limit,
    skip.value,
    filters.search,
    filters.status,
  ]),
  queryFn: () =>
    fetchCustomers({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
    }),
})

const totalPages = computed(() => {
  const total = customersQuery.data.value?.total ?? 0
  return Math.max(1, Math.ceil(total / pagination.limit))
})

const resetForm = () => {
  form.companyName = ''
  form.contactPerson = ''
  form.email = ''
  form.phone = ''
  form.address = ''
  form.taxNumber = ''
  form.status = 'ACTIVE'
}

const openCreateModal = () => {
  editingCustomer.value = null
  resetForm()
  isModalOpen.value = true
}

const openEditModal = (customer: Customer) => {
  editingCustomer.value = customer
  form.companyName = customer.companyName
  form.contactPerson = customer.contactPerson ?? ''
  form.email = customer.email ?? ''
  form.phone = customer.phone ?? ''
  form.address = customer.address ?? ''
  form.taxNumber = customer.taxNumber ?? ''
  form.status = customer.status
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const invalidateCustomers = async () => {
  await queryClient.invalidateQueries({ queryKey: ['customers'] })
}

const createMutation = useMutation({
  mutationFn: (payload: UpsertCustomerPayload) => createCustomer(payload),
  onSuccess: async () => {
    await invalidateCustomers()
    closeModal()
  },
})

const updateMutation = useMutation({
  mutationFn: ({ id, payload }: { id: string; payload: UpsertCustomerPayload }) =>
    updateCustomer(id, payload),
  onSuccess: async () => {
    await invalidateCustomers()
    closeModal()
  },
})

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteCustomer(id),
  onSuccess: async () => {
    await invalidateCustomers()
  },
})

const submitForm = async () => {
  const payload: UpsertCustomerPayload = {
    companyName: form.companyName.trim(),
    contactPerson: form.contactPerson?.trim() || undefined,
    email: form.email?.trim() || undefined,
    phone: form.phone?.trim() || undefined,
    address: form.address?.trim() || undefined,
    taxNumber: form.taxNumber?.trim() || undefined,
    status: form.status,
  }

  if (!payload.companyName) {
    return
  }

  if (editingCustomer.value) {
    await updateMutation.mutateAsync({
      id: editingCustomer.value.id,
      payload,
    })
    return
  }

  await createMutation.mutateAsync(payload)
}

const setPage = (page: number) => {
  if (page < 1 || page > totalPages.value) {
    return
  }
  pagination.page = page
}

const toneForStatus = (status: CustomerStatus) => {
  if (status === 'ACTIVE') return 'success'
  if (status === 'BLOCKED') return 'danger'
  return 'warning'
}

const applyFilters = () => {
  pagination.page = 1
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-xl font-semibold">Customers</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Manage customer profiles, contacts, and lifecycle status.
        </p>
      </div>
      <button
        class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
        type="button"
        @click="openCreateModal"
      >
        New Customer
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input
          v-model="filters.search"
          class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
          placeholder="Search customer, email, contact..."
          type="search"
        />
        <select
          v-model="filters.status"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <button
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
          type="button"
          @click="applyFilters"
        >
          Apply
        </button>
      </div>

      <div v-if="customersQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading customers...</div>
      <div v-else-if="customersQuery.isError.value" class="py-8 text-sm text-rose-600">
        Failed to load customers.
      </div>
      <div v-else-if="(customersQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">
        No customers found.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Company</th>
              <th class="px-3 py-2">Contact</th>
              <th class="px-3 py-2">Email</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="customer in customersQuery.data.value?.data ?? []"
              :key="customer.id"
              class="border-b border-slate-100 dark:border-slate-900"
            >
              <td class="px-3 py-3">{{ customer.customerCode }}</td>
              <td class="px-3 py-3 font-medium">{{ customer.companyName }}</td>
              <td class="px-3 py-3">{{ customer.contactPerson || '-' }}</td>
              <td class="px-3 py-3">{{ customer.email || '-' }}</td>
              <td class="px-3 py-3">
                <StatusBadge :label="customer.status" :tone="toneForStatus(customer.status)" />
              </td>
              <td class="px-3 py-3 text-right">
                <button
                  class="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
                  type="button"
                  @click="openEditModal(customer)"
                >
                  Edit
                </button>
                <button
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  type="button"
                  @click="deleteMutation.mutate(customer.id)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Total: {{ customersQuery.data.value?.total ?? 0 }}
        </p>
        <div class="flex items-center gap-2">
          <button
            class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
            type="button"
            @click="setPage(pagination.page - 1)"
          >
            Prev
          </button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button
            class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
            type="button"
            @click="setPage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">
            {{ editingCustomer ? 'Edit Customer' : 'Create Customer' }}
          </h4>
          <button class="text-sm text-slate-500" type="button" @click="closeModal">Close</button>
        </div>
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="submitForm">
          <input v-model="form.companyName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Company name *" />
          <input v-model="form.contactPerson" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Contact person" />
          <input v-model="form.phone" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Phone" />
          <input v-model="form.email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Email" type="email" />
          <input v-model="form.taxNumber" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Tax number" />
          <select v-model="form.status" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <textarea v-model="form.address" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Address" rows="3" />
          <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" @click="closeModal">
              Cancel
            </button>
            <button
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
              type="submit"
              :disabled="createMutation.isPending.value || updateMutation.isPending.value"
            >
              {{ editingCustomer ? 'Save Changes' : 'Create Customer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
