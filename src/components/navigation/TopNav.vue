<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { fetchQuickView, globalSearch, type GlobalSearchItem } from '@/api/search'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const darkMode = ref(false)

const pageTitle = computed(() => {
  const value = route.meta.title
  return typeof value === 'string' ? value : 'Sales Management'
})

const toggleTheme = () => {
  darkMode.value = !darkMode.value
  document.documentElement.classList.toggle('dark', darkMode.value)
}

const searchTerm = ref('')
const debouncedSearchTerm = ref('')
const searchOpen = ref(false)
let searchTimer: number | undefined

watch(searchTerm, (value) => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    debouncedSearchTerm.value = value.trim()
  }, 220)
})

const searchQuery = useQuery({
  queryKey: computed(() => ['topbar-global-search', debouncedSearchTerm.value]),
  queryFn: () =>
    globalSearch({
      q: debouncedSearchTerm.value,
      limit: 5,
    }),
  enabled: computed(
    () => authStore.isAuthenticated && debouncedSearchTerm.value.length >= 2,
  ),
})

const searchResults = computed(() => searchQuery.data.value?.data ?? [])
const quickViewOpen = ref(false)
const quickViewItem = ref<GlobalSearchItem | null>(null)

const quickViewQuery = useQuery({
  queryKey: computed(() => ['topbar-quick-view', quickViewItem.value?.type, quickViewItem.value?.id]),
  queryFn: () =>
    fetchQuickView({
      type: quickViewItem.value!.type,
      id: quickViewItem.value!.id,
    }),
  enabled: computed(() => quickViewOpen.value && Boolean(quickViewItem.value)),
})

const openQuickView = (item: GlobalSearchItem) => {
  searchOpen.value = false
  quickViewItem.value = item
  quickViewOpen.value = true
}

const openFullPage = async () => {
  const item = quickViewItem.value
  if (!item) return
  quickViewOpen.value = false
  searchTerm.value = ''
  debouncedSearchTerm.value = ''
  await router.push({
    path: item.route,
    query: {
      search: item.label,
    },
  })
}

const submitSearch = async () => {
  const first = searchResults.value[0]
  if (first) {
    openQuickView(first)
  }
}

const closeSearch = () => {
  window.setTimeout(() => {
    searchOpen.value = false
  }, 150)
}

const logoutLoading = ref(false)
const logout = async () => {
  logoutLoading.value = true
  try {
    await authStore.signOut()
    await router.replace('/login')
  } finally {
    logoutLoading.value = false
  }
}
</script>

<template>
  <header class="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">ERP Workspace</p>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ pageTitle }}</h2>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <input
            v-model="searchTerm"
            class="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Search customers, documents..."
            type="search"
            @focus="searchOpen = true"
            @blur="closeSearch"
            @keydown.enter.prevent="submitSearch"
          />
          <div
            v-if="searchOpen && searchTerm.trim().length >= 2"
            class="absolute right-0 top-11 z-50 w-[26rem] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950"
          >
            <div v-if="searchQuery.isLoading.value" class="px-2 py-4 text-xs text-slate-500">Searching...</div>
            <div v-else-if="searchQuery.isError.value" class="px-2 py-4 text-xs text-rose-600">Search failed.</div>
            <div v-else-if="searchResults.length === 0" class="px-2 py-4 text-xs text-slate-500">No results found.</div>
            <button
              v-for="item in searchResults"
              :key="`${item.type}-${item.id}`"
              class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-900"
              type="button"
              @mousedown.prevent
              @click="openQuickView(item)"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.label }}</p>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ item.subtitle || '-' }}</p>
              </div>
              <span class="ml-3 shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {{ item.type.replace('_', ' ') }}
              </span>
            </button>
          </div>
        </div>
        <button
          class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          type="button"
          @click="toggleTheme"
        >
          {{ darkMode ? 'Light' : 'Dark' }}
        </button>
        <div class="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">
          {{ authStore.displayName || authStore.user?.email || 'User' }}
        </div>
        <button
          class="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-700 dark:text-rose-300"
          type="button"
          :disabled="logoutLoading"
          @click="logout"
        >
          {{ logoutLoading ? 'Logging out...' : 'Logout' }}
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="quickViewOpen" class="fixed inset-0 z-[140]">
        <div class="absolute inset-0 bg-slate-900/45" @click="quickViewOpen = false" />
        <aside class="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          <div class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick View</p>
              <h3 class="text-base font-semibold">{{ quickViewItem?.label || 'Result' }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ quickViewItem?.subtitle || '-' }}</p>
            </div>
            <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" type="button" @click="quickViewOpen = false">Close</button>
          </div>

          <div class="h-[calc(100%-120px)] overflow-y-auto bg-white p-4 dark:bg-slate-950">
            <div v-if="quickViewQuery.isLoading.value" class="py-6 text-sm text-slate-500">Loading details...</div>
            <div v-else-if="quickViewQuery.isError.value" class="py-6 text-sm text-rose-600">Failed to load quick view details.</div>
            <div v-else class="space-y-2">
              <div
                v-for="row in quickViewQuery.data.value?.details ?? []"
                :key="row.label"
                class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
              >
                <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ row.label }}</p>
                <p class="mt-0.5 text-sm">{{ row.value }}</p>
              </div>
            </div>
          </div>

          <div class="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <button
              class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
              type="button"
              @click="openFullPage"
            >
              Open Full Page
            </button>
          </div>
        </aside>
      </div>
    </Teleport>
  </header>
</template>
