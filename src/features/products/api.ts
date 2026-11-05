import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/components/shared/Pagination'
import { PRODUCT_IMAGES_BUCKET, supabase } from '@/lib/supabase/client'
import type { ProductValues } from './schema'

export const productsKey = ['products'] as const

export const PRODUCT_COLUMNS =
  'id, name, slug, sku, barcode, brand, category_id, description, cost_price, sale_price, stock_quantity, low_stock_threshold, image_path, is_active, is_published, created_at, updated_at, categories(name)'

export type ProductStatusFilter = 'all' | 'active' | 'inactive' | 'published' | 'unpublished' | 'out'

export interface ProductListParams {
  search: string
  status: ProductStatusFilter
  categoryId: string | null
  page: number
}

/** Escapa caracteres especiales para filtros ilike de PostgREST. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')}%`
}

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: [...productsKey, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('products').select(PRODUCT_COLUMNS, { count: 'exact' })
      const term = params.search.trim()
      if (term) q = q.or(`name.ilike.${likePattern(term)},sku.ilike.${likePattern(term)},barcode.eq.${term.replace(/[,()]/g, '')}`)
      if (params.categoryId) q = q.eq('category_id', params.categoryId)
      switch (params.status) {
        case 'active':
          q = q.eq('is_active', true)
          break
        case 'inactive':
          q = q.eq('is_active', false)
          break
        case 'published':
          q = q.eq('is_published', true).eq('is_active', true)
          break
        case 'unpublished':
          q = q.eq('is_published', false)
          break
        case 'out':
          q = q.eq('stock_quantity', 0)
          break
      }
      const from = params.page * PAGE_SIZE
      const { data, error, count } = await q.order('name').range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data, total: count ?? 0 }
    },
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: [...productsKey, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select(PRODUCT_COLUMNS).eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Búsqueda rápida (POS e inventario). Por defecto solo productos activos. */
export function useProductSearch(term: string, { includeInactive = false } = {}) {
  const t = term.trim()
  return useQuery({
    queryKey: [...productsKey, 'quick-search', t, includeInactive],
    enabled: t.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, name, sku, barcode, sale_price, stock_quantity, low_stock_threshold, image_path, is_active')
        .or(`name.ilike.${likePattern(t)},sku.ilike.${likePattern(t)},barcode.eq.${t.replace(/[,()]/g, '')}`)
      if (!includeInactive) q = q.eq('is_active', true)
      const { data, error } = await q.order('name').limit(12)
      if (error) throw error
      return data
    },
  })
}

export type QuickProduct = NonNullable<ReturnType<typeof useProductSearch>['data']>[number]

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `products/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeProductImage(path: string): Promise<void> {
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
}

interface SaveProductArgs {
  id?: string
  values: ProductValues
  newImage: File | null
  removeImage: boolean
  previousImagePath: string | null
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values, newImage, removeImage, previousImagePath }: SaveProductArgs) => {
      let imagePath = removeImage ? null : previousImagePath
      let uploaded: string | null = null
      if (newImage) {
        uploaded = await uploadProductImage(newImage)
        imagePath = uploaded
      }
      const { stock_quantity, ...editable } = values
      try {
        if (id) {
          // La edición NO toca stock_quantity: las existencias cambian desde Inventario.
          const { error } = await supabase.from('products').update({ ...editable, image_path: imagePath }).eq('id', id)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('products')
            .insert({ ...editable, stock_quantity, image_path: imagePath })
            .select('id')
            .single()
          if (error) throw error
          id = data.id
        }
      } catch (e) {
        if (uploaded) await removeProductImage(uploaded).catch(() => undefined)
        throw e
      }
      // La referencia ya apunta a la nueva imagen: la anterior se puede borrar.
      if (previousImagePath && previousImagePath !== imagePath) await removeProductImage(previousImagePath).catch(() => undefined)
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  })
}

export function useToggleProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { is_active?: boolean; is_published?: boolean } }) => {
      const { error } = await supabase.from('products').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  })
}
