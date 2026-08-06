<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { primaryNavigation } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const visibleNavigation = computed(() =>
  primaryNavigation.filter((item) => !item.permission || authStore.hasPermission(item.permission)),
)

const isActive = (path: string) =>
  route.path === path || route.path.startsWith(`${path}/`)
</script>

<template>
  <aside class="hidden w-64 border-r border-slate-200 bg-white p-4 lg:block dark:border-slate-800 dark:bg-slate-950">
    <div class="mb-8">
      <p class="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Sales ERP</p>
      <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Sales Management</h1>
    </div>
    <nav class="space-y-1">
      <RouterLink
        v-for="item in visibleNavigation"
        :key="item.to"
        :to="item.to"
        class="block rounded-lg px-3 py-2 text-sm transition"
        :class="isActive(item.to)
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
