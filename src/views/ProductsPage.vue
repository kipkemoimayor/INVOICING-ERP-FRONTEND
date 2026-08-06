<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createProduct,
  deleteProduct,
  fetchProductCategories,
  fetchProducts,
  type Product,
  updateProduct,
  type UpsertProductPayload,
} from '@/api/products'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const queryClient = useQueryClient()
const pagination = reactive({ page: 1, limit: 10 })
const filters = reactive<{ search: string; categoryId: string; state: '' | 'active' | 'inactive' }>({
  search: '',
  categoryId: '',
  state: '',
})

const form = reactive({
  sku: '',
  name: '',
  description: '',
  sellingPrice: 0,
  costPrice: 0,
  stock: 0,
  taxPercent: 0,
  unit: 'pcs',
  isActive: true,
  categoryId: '',
  categoryName: '',
})

const isModalOpen = ref(false)
const editingProduct = ref<Product | null>(null)
const skip = computed(() => (pagination.page - 1) * pagination.limit)

const categoriesQuery = useQuery({
  queryKey: ['product-categories'],
  queryFn: fetchProductCategories,
})

const productsQuery = useQuery({
  queryKey: computed(() => [
    'products',
    pagination.limit,
    skip.value,
    filters.search,
    filters.categoryId,
    filters.state,
  ]),
  queryFn: () =>
    fetchProducts({
      limit: pagination.limit,
      skip: skip.value,
      search: filters.search || undefined,
      categoryId: filters.categoryId || undefined,
      isActive:
        filters.state === ''
          ? undefined
          : filters.state === 'active',
    }),
})

const totalPages = computed(() => {
  const total = productsQuery.data.value?.total ?? 0
  return Math.max(1, Math.ceil(total / pagination.limit))
})

const invalidateProducts = async () => {
  await queryClient.invalidateQueries({ queryKey: ['products'] })
}

const createMutation = useMutation({
  mutationFn: (payload: UpsertProductPayload) => createProduct(payload),
  onSuccess: invalidateProducts,
})

const updateMutation = useMutation({
  mutationFn: ({ id, payload }: { id: string; payload: UpsertProductPayload }) =>
    updateProduct(id, payload),
  onSuccess: invalidateProducts,
})

const deleteMutation = useMutation({
  mutationFn: deleteProduct,
  onSuccess: invalidateProducts,
})

const resetForm = () => {
  form.sku = ''
  form.name = ''
  form.description = ''
  form.sellingPrice = 0
  form.costPrice = 0
  form.stock = 0
  form.taxPercent = 0
  form.unit = 'pcs'
  form.isActive = true
  form.categoryId = ''
  form.categoryName = ''
}

const openCreateModal = () => {
  editingProduct.value = null
  resetForm()
  isModalOpen.value = true
}

const openEditModal = (product: Product) => {
  editingProduct.value = product
  form.sku = product.sku
  form.name = product.name
  form.description = product.description || ''
  form.sellingPrice = Number(product.sellingPrice)
  form.costPrice = Number(product.costPrice)
  form.stock = Number(product.stock)
  form.taxPercent = Number(product.taxPercent)
  form.unit = product.unit
  form.isActive = product.isActive
  form.categoryId = product.categoryId || ''
  form.categoryName = ''
  isModalOpen.value = true
}

const submitForm = async () => {
  if (!form.name.trim()) return
  if (!editingProduct.value && !form.sku.trim()) return

  const payload: UpsertProductPayload = {
    ...(editingProduct.value ? {} : { sku: form.sku.trim().toUpperCase() }),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    sellingPrice: Number(form.sellingPrice),
    costPrice: Number(form.costPrice),
    stock: Number(form.stock),
    taxPercent: Number(form.taxPercent),
    unit: form.unit.trim(),
    isActive: form.isActive,
    categoryId: form.categoryId || undefined,
    categoryName: form.categoryName.trim() || undefined,
  }

  if (editingProduct.value) {
    await updateMutation.mutateAsync({ id: editingProduct.value.id, payload })
  } else {
    await createMutation.mutateAsync(payload)
  }

  isModalOpen.value = false
}

const setPage = (value: number) => {
  if (value < 1 || value > totalPages.value) return
  pagination.page = value
}

const applyFilters = () => {
  pagination.page = 1
}
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-xl font-semibold">Products & Services</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Manage goods/services catalog, pricing, tax, and optional stock tracking.</p>
      </div>
      <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" @click="openCreateModal">
        New Item / Service
      </button>
    </header>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input v-model="filters.search" class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Search SKU, item, service..." type="search" />
        <select v-model="filters.categoryId" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All categories</option>
          <option v-for="category in categoriesQuery.data.value ?? []" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <select v-model="filters.state" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All states</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700" @click="applyFilters">Apply</button>
      </div>

      <div v-if="productsQuery.isLoading.value" class="py-8 text-sm text-slate-500">Loading items/services...</div>
      <div v-else-if="productsQuery.isError.value" class="py-8 text-sm text-rose-600">Failed to load items/services.</div>
      <div v-else-if="(productsQuery.data.value?.data.length ?? 0) === 0" class="py-8 text-sm text-slate-500">No items/services found.</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800">
              <th class="px-3 py-2">SKU</th>
              <th class="px-3 py-2">Item / Service</th>
              <th class="px-3 py-2">Category</th>
              <th class="px-3 py-2">Price</th>
              <th class="px-3 py-2">Stock</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in productsQuery.data.value?.data ?? []" :key="product.id" class="border-b border-slate-100 dark:border-slate-900">
              <td class="px-3 py-3">{{ product.sku }}</td>
              <td class="px-3 py-3 font-medium">{{ product.name }}</td>
              <td class="px-3 py-3">{{ product.category?.name ?? '-' }}</td>
              <td class="px-3 py-3">{{ product.sellingPrice }}</td>
              <td class="px-3 py-3">{{ product.stock }} {{ product.unit }}</td>
              <td class="px-3 py-3">
                <StatusBadge :label="product.isActive ? 'ACTIVE' : 'INACTIVE'" :tone="product.isActive ? 'success' : 'warning'" />
              </td>
              <td class="px-3 py-3 text-right">
                <button class="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="openEditModal(product)">Edit</button>
                <button class="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 dark:border-rose-700" @click="deleteMutation.mutate(product.id)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">Total: {{ productsQuery.data.value?.total ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page - 1)">Prev</button>
          <span class="text-xs">Page {{ pagination.page }} / {{ totalPages }}</span>
          <button class="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" @click="setPage(pagination.page + 1)">Next</button>
        </div>
      </div>
    </div>

    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-lg font-semibold">{{ editingProduct ? 'Edit Item / Service' : 'Create Item / Service' }}</h4>
          <button class="text-sm text-slate-500" @click="isModalOpen = false">Close</button>
        </div>
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="submitForm">
          <input v-if="!editingProduct" v-model="form.sku" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="SKU *" />
          <input v-model="form.name" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" :class="{ 'sm:col-span-2': editingProduct }" placeholder="Item / service name *" />
          <input v-model.number="form.sellingPrice" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Selling price" type="number" min="0" step="0.01" />
          <input v-model.number="form.costPrice" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Cost price" type="number" min="0" step="0.01" />
          <input v-model.number="form.stock" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Stock" type="number" min="0" step="0.001" />
          <input v-model.number="form.taxPercent" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Tax %" type="number" min="0" step="0.01" />
          <input v-model="form.unit" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Unit" />
          <select v-model="form.categoryId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">No category</option>
            <option v-for="category in categoriesQuery.data.value ?? []" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
          <input v-model="form.categoryName" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Or create category by name" />
          <textarea v-model="form.description" class="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-2" placeholder="Description" rows="3" />
          <label class="sm:col-span-2 inline-flex items-center gap-2 text-sm">
            <input v-model="form.isActive" type="checkbox" />
            Active product
          </label>
          <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700" type="button" @click="isModalOpen = false">Cancel</button>
            <button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900" type="submit">
              {{ editingProduct ? 'Save Changes' : 'Create Item / Service' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
