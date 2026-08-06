<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createRole, deleteRole, fetchPermissions, fetchRoles, updateRole, type Role } from '@/api/roles'
import { extractApiErrorMessage } from '@/lib/api'

type ToastType = 'success' | 'error'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive({ search: '' })
const permissionFilters = reactive({ search: '' })
const roleModalOpen = ref(false)
const editingRoleId = ref('')
const form = reactive({
  name: '',
  description: '',
  permissionIds: [] as string[],
})
const deleteActionRoleId = ref('')
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined

const skip = computed(() => (pagination.page - 1) * pagination.limit)
const rolesQuery = useQuery({
  queryKey: computed(() => ['roles', pagination.limit, skip.value, filters.search]),
  queryFn: () =>
    fetchRoles({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
    }),
})
const permissionsQuery = useQuery({
  queryKey: computed(() => ['permissions', permissionFilters.search]),
  queryFn: () => fetchPermissions(permissionFilters.search || undefined),
})
const totalPages = computed(() => Math.max(1, Math.ceil((rolesQuery.data.value?.total ?? 0) / pagination.limit)))
const allVisiblePermissionsSelected = computed(() => {
  const permissions = permissionsQuery.data.value ?? []
  if (permissions.length === 0) return false
  return permissions.every((permission) => form.permissionIds.includes(permission.id))
})

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

const invalidateRoles = async () => {
  await queryClient.invalidateQueries({ queryKey: ['roles'] })
}

const createMutation = useMutation({
  mutationFn: createRole,
  onSuccess: async () => {
    await invalidateRoles()
    roleModalOpen.value = false
    showToast('success', 'Role created successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const updateMutation = useMutation({
  mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRole>[1] }) => updateRole(id, payload),
  onSuccess: async () => {
    await invalidateRoles()
    roleModalOpen.value = false
    showToast('success', 'Role updated successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const deleteMutation = useMutation({
  mutationFn: deleteRole,
  onSuccess: async () => {
    await invalidateRoles()
    showToast('success', 'Role deleted successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.permissionIds = []
}

const openCreateModal = () => {
  editingRoleId.value = ''
  resetForm()
  roleModalOpen.value = true
}

const openEditModal = (role: Role) => {
  editingRoleId.value = role.id
  form.name = role.name
  form.description = role.description ?? ''
  form.permissionIds = role.permissions.map((p) => p.id)
  roleModalOpen.value = true
}

const togglePermissionSelection = (permissionId: string) => {
  if (form.permissionIds.includes(permissionId)) {
    form.permissionIds = form.permissionIds.filter((id) => id !== permissionId)
    return
  }
  form.permissionIds = [...form.permissionIds, permissionId]
}

const selectAllVisiblePermissions = () => {
  const permissions = permissionsQuery.data.value ?? []
  if (permissions.length === 0) return
  form.permissionIds = permissions.map((permission) => permission.id)
}

const clearPermissionSelection = () => {
  form.permissionIds = []
}

const submitRole = async () => {
  if (!form.name.trim()) {
    showToast('error', 'Role name is required.')
    return
  }
  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    permissionIds: form.permissionIds,
  }

  if (!editingRoleId.value) {
    await createMutation.mutateAsync(payload)
    return
  }

  await updateMutation.mutateAsync({
    id: editingRoleId.value,
    payload,
  })
}

const deleteAction = async (role: Role) => {
  if (role.isSystem) {
    showToast('error', 'System roles cannot be deleted.')
    return
  }
  deleteActionRoleId.value = role.id
  try {
    await deleteMutation.mutateAsync(role.id)
  } finally {
    deleteActionRoleId.value = ''
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h3 class="text-xl font-semibold">Roles</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Manage role definitions and permission mappings.</p>
      </div>
      <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="openCreateModal">
        Add Role
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search role name/description..." type="search" />
      </div>

      <div v-if="rolesQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading roles...</div>
      <div v-else-if="rolesQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load roles.</div>
      <div v-else-if="(rolesQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No roles found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Role</th>
              <th class="px-3 py-2">Description</th>
              <th class="px-3 py-2">Permissions</th>
              <th class="px-3 py-2">Users</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in rolesQuery.data.value?.data ?? []" :key="role.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">
                {{ role.name }}
                <span v-if="role.isSystem" class="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase dark:bg-slate-800">System</span>
              </td>
              <td class="px-3 py-3">{{ role.description || '-' }}</td>
              <td class="px-3 py-3">{{ role.permissions.map((x) => x.code).join(', ') || '-' }}</td>
              <td class="px-3 py-3">{{ role._count.userRoles }}</td>
              <td class="space-x-2 px-3 py-3 text-right">
                <button class="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="openEditModal(role)">Edit</button>
                <button
                  class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700"
                  :disabled="deleteMutation.isPending.value || deleteActionRoleId === role.id || role.isSystem"
                  @click="deleteAction(role)"
                >
                  {{ deleteActionRoleId === role.id ? 'Deleting...' : 'Delete' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ rolesQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h4 class="text-base font-semibold">Permissions</h4>
        <input
          v-model="permissionFilters.search"
          class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Search permission code/name..."
          type="search"
        />
      </div>
      <div v-if="permissionsQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading permissions...</div>
      <div v-else-if="permissionsQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load permissions.</div>
      <div v-else-if="(permissionsQuery.data.value?.length ?? 0) === 0" class="py-8 text-sm text-slate-500">
        No permissions found.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">Code</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="permission in permissionsQuery.data.value ?? []"
              :key="permission.id"
              class="border-b border-slate-100 dark:border-slate-900"
            >
              <td class="px-3 py-3 font-mono text-xs">{{ permission.code }}</td>
              <td class="px-3 py-3">{{ permission.name }}</td>
              <td class="px-3 py-3">{{ permission.description || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="roleModalOpen" class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">{{ editingRoleId ? 'Edit Role' : 'Create Role' }}</h4>
          <button class="text-sm text-slate-500" :disabled="createMutation.isPending.value || updateMutation.isPending.value" @click="roleModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3" @submit.prevent="submitRole">
          <input v-model="form.name" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Role name" />
          <textarea v-model="form.description" class="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Description (optional)" />
          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Permissions</p>
              <div class="flex items-center gap-2">
                <button
                  class="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700"
                  type="button"
                  :disabled="permissionsQuery.isLoading.value || (permissionsQuery.data.value?.length ?? 0) === 0 || allVisiblePermissionsSelected"
                  @click="selectAllVisiblePermissions"
                >
                  Select All
                </button>
                <button
                  class="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700"
                  type="button"
                  :disabled="form.permissionIds.length === 0"
                  @click="clearPermissionSelection"
                >
                  Clear
                </button>
              </div>
            </div>
            <div v-if="permissionsQuery.isLoading.value" class="text-xs text-slate-500">Loading permissions...</div>
            <div v-else-if="(permissionsQuery.data.value?.length ?? 0) === 0" class="text-xs text-amber-700 dark:text-amber-400">
              No permissions found. Use the Permissions section to verify available permissions.
            </div>
            <div v-else class="grid gap-2 sm:grid-cols-2">
              <label v-for="permission in permissionsQuery.data.value ?? []" :key="permission.id" class="flex items-center gap-2 text-sm">
                <input type="checkbox" :checked="form.permissionIds.includes(permission.id)" @change="togglePermissionSelection(permission.id)" />
                <span>{{ permission.code }}</span>
              </label>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" :disabled="createMutation.isPending.value || updateMutation.isPending.value" @click="roleModalOpen = false">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="createMutation.isPending.value || updateMutation.isPending.value">
              {{ createMutation.isPending.value || updateMutation.isPending.value ? 'Saving...' : 'Save Role' }}
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
