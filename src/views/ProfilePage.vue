<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { changePassword, fetchProfile, updateProfile } from '@/api/profile'
import { extractApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

type ToastType = 'success' | 'error'

const authStore = useAuthStore()
const toast = ref<{ type: ToastType; message: string } | null>(null)
let toastTimer: number | undefined

const profileForm = reactive({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const showToast = (type: ToastType, message: string) => {
  toast.value = { type, message }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 3000)
}

const profileQuery = useQuery({
  queryKey: ['profile'],
  queryFn: fetchProfile,
})

watch(
  () => profileQuery.data.value,
  (value) => {
    if (!value) return
    profileForm.email = value.email
    profileForm.firstName = value.firstName
    profileForm.lastName = value.lastName
    profileForm.phone = value.phone ?? ''
  },
  { immediate: true },
)

const updateMutation = useMutation({
  mutationFn: updateProfile,
  onSuccess: async (updated) => {
    profileForm.email = updated.email
    profileForm.firstName = updated.firstName
    profileForm.lastName = updated.lastName
    profileForm.phone = updated.phone ?? ''
    await authStore.refreshMe()
    await profileQuery.refetch()
    showToast('success', 'Profile updated successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const changePasswordMutation = useMutation({
  mutationFn: changePassword,
  onSuccess: async () => {
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    showToast('success', 'Password changed successfully.')
  },
  onError: (error) => showToast('error', extractApiErrorMessage(error)),
})

const submitProfile = async () => {
  if (!profileForm.email.trim() || !profileForm.firstName.trim() || !profileForm.lastName.trim()) {
    showToast('error', 'Email, first name, and last name are required.')
    return
  }

  await updateMutation.mutateAsync({
    email: profileForm.email.trim(),
    firstName: profileForm.firstName.trim(),
    lastName: profileForm.lastName.trim(),
    phone: profileForm.phone.trim() || undefined,
  })
}

const submitPassword = async () => {
  if (!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim()) {
    showToast('error', 'Current and new password are required.')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('error', 'New password confirmation does not match.')
    return
  }
  await changePasswordMutation.mutateAsync({
    currentPassword: passwordForm.currentPassword,
    newPassword: passwordForm.newPassword,
  })
}
</script>

<template>
  <section class="space-y-4">
    <header>
      <h3 class="text-xl font-semibold">Profile</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">Manage your account details and security settings.</p>
    </header>

    <div v-if="profileQuery.isLoading.value" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      Loading profile...
    </div>
    <div v-else-if="profileQuery.isError.value" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-rose-600 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      Failed to load profile information.
    </div>
    <div v-else class="grid gap-4 xl:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 xl:col-span-2">
        <h4 class="text-base font-semibold">Personal Information</h4>
        <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="submitProfile">
          <input v-model="profileForm.firstName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="First name" />
          <input v-model="profileForm.lastName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Last name" />
          <input v-model="profileForm.email" type="email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Email" />
          <input v-model="profileForm.phone" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Phone (optional)" />
          <div class="sm:col-span-2 flex justify-end">
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit" :disabled="updateMutation.isPending.value">
              {{ updateMutation.isPending.value ? 'Saving...' : 'Save Profile' }}
            </button>
          </div>
        </form>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h4 class="text-base font-semibold">Account Summary</h4>
        <div class="mt-3 space-y-2 text-sm">
          <p><span class="text-slate-500 dark:text-slate-400">Status:</span> <span class="font-medium">{{ profileQuery.data.value?.status || '-' }}</span></p>
          <p><span class="text-slate-500 dark:text-slate-400">Roles:</span> <span class="font-medium">{{ (profileQuery.data.value?.roles ?? []).join(', ') || '-' }}</span></p>
          <p><span class="text-slate-500 dark:text-slate-400">Last Login:</span> <span class="font-medium">{{ profileQuery.data.value?.lastLoginAt ? new Date(profileQuery.data.value.lastLoginAt).toLocaleString() : '-' }}</span></p>
          <p><span class="text-slate-500 dark:text-slate-400">Created:</span> <span class="font-medium">{{ profileQuery.data.value?.createdAt ? new Date(profileQuery.data.value.createdAt).toLocaleDateString() : '-' }}</span></p>
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h4 class="text-base font-semibold">Change Password</h4>
      <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="submitPassword">
        <input v-model="passwordForm.currentPassword" type="password" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Current password" />
        <input v-model="passwordForm.newPassword" type="password" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="New password" />
        <input v-model="passwordForm.confirmPassword" type="password" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Confirm new password" />
        <div class="sm:col-span-2 flex justify-end">
          <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700" type="submit" :disabled="changePasswordMutation.isPending.value">
            {{ changePasswordMutation.isPending.value ? 'Updating...' : 'Update Password' }}
          </button>
        </div>
      </form>
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
