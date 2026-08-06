<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }>()

const classes = computed(() => {
  if (props.tone === 'success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
  if (props.tone === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
  if (props.tone === 'danger') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200'
})
</script>

<template>
  <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" :class="classes">
    {{ label }}
  </span>
</template>
