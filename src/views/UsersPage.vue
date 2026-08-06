<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { extractApiErrorMessage } from '@/lib/api'
import {
  createUser,
  deleteUser,
  fetchRoles,
  fetchUsers,
  updateUser,
  updateUserStatus,
  type User,
  type UserStatus,
} from '@/api/users'

type ToastType = 'success' | 'error'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{
  search: string
  status: '' | UserStatus
  roleId: string
}>({
  search: '',
  status: '',
  roleId: '',
})
const userModalOpen = ref(false)
const editingUserId = ref('')
const form = reactive({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  status: 'ACTIVE' as UserStatus,
  roleIds: [] as string[],
})
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined
const statusActionUserId = ref('')
const deleteActionUserId = ref('')

const skip = computed(() => (pagination.page - 1) * pagination.limit)

const usersQuery = useQuery({
  queryKey: computed(() => ['users', pagination.limit, skip.value, filters.search, filters.status, filters.roleId]),
  queryFn: () =>
    fetchUsers({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
      roleId: filters.roleId || undefined,
    }),
})

const rolesQuery = useQuery({
  queryKey: ['user-roles'],
  queryFn: fetchRoles,
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil((usersQuery.data.value?.total ?? 0) / pagination.limit)),
)

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const invalidateUsers = async () => {
  await queryClient.invalidateQueries({ queryKey: ['users'] })
}

const createMutation = useMutation({
  mutationFn: createUser,
  onSuccess: async () => {
    await invalidateUsers()
    userModalOpen.value = false
    showToast('success', 'User created successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const updateMutation = useMutation({
  mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateUser>[1] }) => updateUser(id, payload),
  onSuccess: async () => {
    await invalidateUsers()
    userModalOpen.value = false
    showToast('success', 'User updated successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const statusMutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: UserStatus }) => updateUserStatus(id, status),
  onSuccess: async () => {
    await invalidateUsers()
    showToast('success', 'User status updated.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const deleteMutation = useMutation({
  mutationFn: deleteUser,
  onSuccess: async () => {
    await invalidateUsers()
    showToast('success', 'User deleted successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const userTone = (status: UserStatus) => {
  if (status === 'ACTIVE') return 'success'
  if (status === 'LOCKED') return 'danger'
  return 'warning'
}

const openCreateModal = () => {
  editingUserId.value = ''
  form.email = ''
  form.password = ''
  form.firstName = ''
  form.lastName = ''
  form.phone = ''
  form.status = 'ACTIVE'
  form.roleIds = []
  userModalOpen.value = true
}

const openEditModal = (user: User) => {
  editingUserId.value = user.id
  form.email = user.email
  form.password = ''
  form.firstName = user.firstName
  form.lastName = user.lastName
  form.phone = user.phone ?? ''
  form.status = user.status
  form.roleIds = user.userRoles.map((x) => x.role.id)
  userModalOpen.value = true
}

const toggleRoleSelection = (roleId: string) => {
  if (form.roleIds.includes(roleId)) {
    form.roleIds = form.roleIds.filter((id) => id !== roleId)
    return
  }
  form.roleIds = [...form.roleIds, roleId]
}

const submitUser = async () => {
  if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
    showToast('error', 'Email, first name and last name are required.')
    return
  }
  if (!editingUserId.value && !form.password.trim()) {
    showToast('error', 'Password is required for new users.')
    return
  }

  const payload = {
    email: form.email.trim(),
    password: form.password.trim() || undefined,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim() || undefined,
    status: form.status,
    roleIds: form.roleIds,
  }

  if (!editingUserId.value) {
    await createMutation.mutateAsync({
      ...payload,
      password: payload.password!,
    })
    return
  }

  await updateMutation.mutateAsync({
    id: editingUserId.value,
    payload,
  })
}

const cycleStatus = (status: UserStatus): UserStatus => {
  if (status === 'ACTIVE') return 'INACTIVE'
  if (status === 'INACTIVE') return 'LOCKED'
  return 'ACTIVE'
}

const updateStatusAction = async (user: User) => {
  statusActionUserId.value = user.id
  try {
    await statusMutation.mutateAsync({
      id: user.id,
      status: cycleStatus(user.status),
    })
  } finally {
    statusActionUserId.value = ''
  }
}

const deleteAction = async (id: string) => {
  deleteActionUserId.value = id
  try {
    await deleteMutation.mutateAsync(id)
  } finally {
    deleteActionUserId.value = ''
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-semibold">Users</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Manage users, statuses, and role assignments.</p>
      </div>
      <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="openCreateModal">
        Add User
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search name/email/phone..." type="search" />
        <select v-model="filters.status" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOCKED">Locked</option>
        </select>
        <select v-model="filters.roleId" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All roles</option>
          <option v-for="role in rolesQuery.data.value ?? []" :key="role.id" :value="role.id">
            {{ role.name }}
          </option>
        </select>
      </div>

      <div v-if="usersQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading users...</div>
      <div v-else-if="usersQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load users.</div>
      <div v-else-if="(usersQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No users found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Email</th>
              <th class="px-3 py-2">Phone</th>
              <th class="px-3 py-2">Roles</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in usersQuery.data.value?.data ?? []" :key="user.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ user.firstName }} {{ user.lastName }}</td>
              <td class="px-3 py-3">{{ user.email }}</td>
              <td class="px-3 py-3">{{ user.phone || '-' }}</td>
              <td class="px-3 py-3">{{ user.userRoles.map((x) => x.role.name).join(', ') || '-' }}</td>
              <td class="px-3 py-3"><StatusBadge :label="user.status" :tone="userTone(user.status)" /></td>
              <td class="px-3 py-3 text-right space-x-2">
                <button class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="openEditModal(user)">Edit</button>
                <button
                  class="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700 dark:border-amber-700"
                  :disabled="statusMutation.isPending.value || statusActionUserId === user.id"
                  @click="updateStatusAction(user)"
                >
                  {{ statusActionUserId === user.id ? 'Updating...' : `Set ${cycleStatus(user.status)}` }}
                </button>
                <button
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  :disabled="deleteMutation.isPending.value || deleteActionUserId === user.id"
                  @click="deleteAction(user.id)"
                >
                  {{ deleteActionUserId === user.id ? 'Deleting...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ usersQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div v-if="userModalOpen" class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">{{ editingUserId ? 'Edit User' : 'Create User' }}</h4>
          <button class="text-sm text-slate-500" :disabled="createMutation.isPending.value || updateMutation.isPending.value" @click="userModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3" @submit.prevent="submitUser">
          <input v-model="form.firstName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="First name" />
          <input v-model="form.lastName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Last name" />
          <input v-model="form.email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Email" type="email" />
          <input v-model="form.phone" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Phone (optional)" />
          <input v-model="form.password" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" :placeholder="editingUserId ? 'Password (leave blank to keep unchanged)' : 'Password'" type="password" />
          <select v-model="form.status" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LOCKED">Locked</option>
          </select>
          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Roles</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <label v-for="role in rolesQuery.data.value ?? []" :key="role.id" class="flex items-center gap-2 text-sm">
                <input type="checkbox" :checked="form.roleIds.includes(role.id)" @change="toggleRoleSelection(role.id)" />
                <span>{{ role.name }}</span>
              </label>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" :disabled="createMutation.isPending.value || updateMutation.isPending.value" @click="userModalOpen = false">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="createMutation.isPending.value || updateMutation.isPending.value">
              {{ createMutation.isPending.value || updateMutation.isPending.value ? 'Saving...' : 'Save User' }}
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
