<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchDashboardStats } from '@/api/dashboard'

const dashboardQuery = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: fetchDashboardStats,
})

const cards = computed(() => {
  const data = dashboardQuery.data.value?.cards
  return [
    { label: 'Today Sales', value: data?.todaySales ?? 0, money: true },
    { label: 'Outstanding Quotations', value: data?.outstandingQuotations ?? 0 },
    { label: 'Pending Deliveries', value: data?.pendingDeliveries ?? 0 },
    { label: 'Pending Payments', value: data?.pendingPayments ?? 0 },
    { label: 'Revenue', value: data?.revenue ?? 0, money: true },
    { label: 'Invoices', value: data?.invoices ?? 0 },
  ]
})

const trendMax = computed(() => {
  const values = dashboardQuery.data.value?.revenueTrend.map((x) => x.total) ?? []
  return Math.max(1, ...values)
})

const formatMoney = (value: number) =>
  `KSH ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
</script>

<template>
  <section class="space-y-4">
    <div v-if="dashboardQuery.isLoading.value" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
      Loading dashboard...
    </div>
    <div v-else-if="dashboardQuery.isError.value" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20">
      Failed to load dashboard stats.
    </div>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="card in cards"
          :key="card.label"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <p class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-semibold">
            {{ card.money ? formatMoney(Number(card.value)) : Number(card.value).toLocaleString() }}
          </p>
        </article>
      </div>
      <div class="grid gap-4 xl:grid-cols-3">
        <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2 dark:border-slate-800 dark:bg-slate-950">
          <h3 class="text-lg font-semibold">Revenue Trend (Last 6 Months)</h3>
          <div class="mt-4 space-y-2">
            <div v-for="point in dashboardQuery.data.value?.revenueTrend ?? []" :key="point.month" class="grid grid-cols-[80px_1fr_130px] items-center gap-2 text-sm">
              <span class="text-slate-500 dark:text-slate-400">{{ point.month }}</span>
              <div class="h-2 rounded bg-slate-100 dark:bg-slate-800">
                <div class="h-2 rounded bg-slate-900 dark:bg-slate-100" :style="{ width: `${Math.max(4, (point.total / trendMax) * 100)}%` }" />
              </div>
              <span class="text-right font-medium">{{ formatMoney(point.total) }}</span>
            </div>
          </div>
        </article>
        <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h3 class="text-lg font-semibold">Top Customers</h3>
          <ul class="mt-3 space-y-2 text-sm">
            <li
              v-for="customer in dashboardQuery.data.value?.topCustomers ?? []"
              :key="customer.customerId"
              class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <span>{{ customer.customerName }}</span>
              <span class="font-medium">{{ formatMoney(customer.amount) }}</span>
            </li>
            <li v-if="(dashboardQuery.data.value?.topCustomers.length ?? 0) === 0" class="text-slate-500 dark:text-slate-400">
              No customer revenue yet.
            </li>
          </ul>
        </article>
      </div>
      <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h3 class="text-lg font-semibold">Recent Activities</h3>
        <ul class="mt-3 space-y-2 text-sm">
          <li
            v-for="activity in dashboardQuery.data.value?.recentActivities ?? []"
            :key="activity.id"
            class="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="font-medium">{{ activity.message }}</p>
              <span class="text-xs text-slate-500 dark:text-slate-400">{{ new Date(activity.createdAt).toLocaleString() }}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ activity.action }} • {{ activity.resourceType }}
            </p>
          </li>
          <li v-if="(dashboardQuery.data.value?.recentActivities.length ?? 0) === 0" class="text-slate-500 dark:text-slate-400">
            No recent activities yet.
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
