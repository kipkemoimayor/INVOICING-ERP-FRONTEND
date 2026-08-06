<script setup lang="ts">
import SidebarNav from '@/components/navigation/SidebarNav.vue'
import TopNav from '@/components/navigation/TopNav.vue'
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <div class="flex min-h-screen">
      <SidebarNav />
      <div class="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main class="flex-1 p-4 lg:p-6">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
