import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/components/shared/Pagination'
import { PRODUCT_IMAGES_BUCKET, supabase } from '@/lib/supabase/client'
import type { GalleryItem } from './gallery'
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

export async function removeProductImages(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths)
}

/** Galería guardada del producto, en orden (la primera es la principal). */
export function useProductImages(productId: string | undefined) {
  return useQuery({
    queryKey: [...productsKey, 'images', productId],
    enabled: Boolean(productId),
    // El formulario se reinicia cuando cambia esta consulta: solo debe recargarse tras guardar.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_images')
        .select('image_path, sort_order')
        .eq('product_id', productId!)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data.map((r) => r.image_path)
    },
  })
}

interface SaveProductArgs {
  id?: string
  values: ProductValues
  /** Galería final en orden: rutas existentes o archivos nuevos por subir. */
  gallery: GalleryItem[]
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values, gallery }: SaveProductArgs) => {
      // 1. Subir las imágenes nuevas.
      const uploaded: string[] = []
      const paths: string[] = []
      try {
        for (const item of gallery) {
          if (item.file) {
            const path = await uploadProductImage(item.file)
            uploaded.push(path)
            paths.push(path)
          } else if (item.path) paths.push(item.path)
        }
      } catch (e) {
        await removeProductImages(uploaded).catch(() => undefined)
        throw e
      }

      // 2. Guardar el producto. La edición NO toca stock_quantity (se cambia desde Inventario)
      //    ni image_path (la mantiene la base de datos a partir de la galería).
      const { stock_quantity, ...editable } = values
      try {
        if (id) {
          const { error } = await supabase.from('products').update(editable).eq('id', id)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('products').insert({ ...editable, stock_quantity }).select('id').single()
          if (error) throw error
          id = data.id
        }
        // 3. Guardar la galería completa en una transacción.
        const { data: removed, error } = await supabase.rpc('set_product_images', { p_product_id: id, p_paths: paths })
        if (error) throw error
        // 4. Las imágenes que ya no se usan se borran de Storage.
        await removeProductImages((removed ?? []).map((r) => r.removed_path)).catch(() => undefined)
      } catch (e) {
        await removeProductImages(uploaded).catch(() => undefined)
        throw e
      }
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
