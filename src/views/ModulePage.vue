<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const route = useRoute()

const title = computed(() => {
  const value = route.meta.title
  return typeof value === 'string' ? value : 'Module'
})
</script>

<template>
  <section class="space-y-4">
    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-xl font-semibold">{{ title }}</h3>
        <StatusBadge label="Scaffolded" tone="success" />
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        This page is scaffolded and ready for module implementation in the next steps.
      </p>
    </div>
  </section>
</template>
