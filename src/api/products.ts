import { apiRequest } from '@/lib/api'

export type ProductCategory = {
  id: string
  name: string
}

export type Product = {
  id: string
  sku: string
  name: string
  description?: string | null
  sellingPrice: string
  costPrice: string
  stock: string
  taxPercent: string
  unit: string
  isActive: boolean
  categoryId?: string | null
  category?: ProductCategory | null
}

export type PaginatedProducts = {
  data: Product[]
  total: number
  limit: number
  skip: number
}

export type UpsertProductPayload = {
  sku?: string
  name: string
  description?: string
  sellingPrice: number
  costPrice: number
  stock?: number
  taxPercent?: number
  unit: string
  isActive?: boolean
  categoryId?: string
  categoryName?: string
}

export async function fetchProducts(params: {
  limit: number
  skip: number
  search?: string
  categoryId?: string
  isActive?: boolean
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    skip: String(params.skip),
  })

  if (params.search) query.set('search', params.search)
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive))

  return apiRequest<PaginatedProducts>(`/products?${query.toString()}`)
}

export async function fetchProductCategories() {
  return apiRequest<ProductCategory[]>('/products/categories')
}

export async function createProduct(payload: UpsertProductPayload) {
  return apiRequest<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateProduct(id: string, payload: UpsertProductPayload) {
  return apiRequest<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteProduct(id: string) {
  return apiRequest<Product>(`/products/${id}`, {
    method: 'DELETE',
  })
}
