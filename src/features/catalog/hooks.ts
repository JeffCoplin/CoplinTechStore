import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase/client'
import { buildWhatsappLink } from '@/lib/utils/whatsapp'
import { getRealtimeStatus, onRealtimeStatusChange, subscribeCatalogChanges } from './realtime'

export const CATALOG_PAGE_SIZE = 24

export const CATALOG_SORTS = [
  { value: null, label: 'Nombre (A–Z)' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'newest', label: 'Más nuevos' },
] as const
export type CatalogSort = (typeof CATALOG_SORTS)[number]['value']

export function parseCatalogSort(raw: string | null): CatalogSort {
  return CATALOG_SORTS.find((s) => s.value === raw)?.value ?? null
}
const catalogKey = ['catalog'] as const

/** Revalidación de respaldo: frecuente si Realtime no está conectado. */
function useFallbackInterval(): number {
  const status = useSyncExternalStore(onRealtimeStatusChange, getRealtimeStatus, getRealtimeStatus)
  return status === 'connected' ? 5 * 60_000 : 45_000
}

export function useStoreInfo() {
  return useQuery({
    queryKey: [...catalogKey, 'store'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_store_info')
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

/** Enlace de WhatsApp con un saludo general (no de un producto concreto). */
export function useStoreWhatsappLink(): string | null {
  const store = useStoreInfo()
  return (
    buildWhatsappLink(store.data?.whatsapp_number, 'el catálogo', `${window.location.origin}/catalogo`)?.replace(
      encodeURIComponent('me interesa este producto: el catálogo'),
      encodeURIComponent('vi su catálogo y tengo una consulta.'),
    ) ?? null
  )
}

export function useCatalogCategories() {
  const refetchInterval = useFallbackInterval()
  return useQuery({
    queryKey: [...catalogKey, 'categories'],
    refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_categories')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCatalogProducts(search: string, categorySlug: string | null, page: number, sort: CatalogSort) {
  const refetchInterval = useFallbackInterval()
  return useQuery({
    queryKey: [...catalogKey, 'products', { search, categorySlug, page, sort }],
    placeholderData: keepPreviousData,
    refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_catalog_products', {
        p_search: search || null,
        p_category_slug: categorySlug,
        p_limit: CATALOG_PAGE_SIZE,
        p_offset: page * CATALOG_PAGE_SIZE,
        // Solo se envía si se eligió: el orden por nombre funciona aunque la migración no esté aplicada.
        ...(sort ? { p_sort: sort } : {}),
      })
      if (error) throw error
      const rows = data ?? []
      return { rows, total: Number(rows[0]?.total_count ?? 0) }
    },
  })
}

export function useCatalogProduct(slug: string) {
  const refetchInterval = useFallbackInterval()
  return useQuery({
    queryKey: [...catalogKey, 'product', slug],
    refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_catalog_product_by_slug', { p_slug: slug })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

/** Escucha el Broadcast saneado y revalida las consultas públicas del catálogo. */
export function useCatalogRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = subscribeCatalogChanges(() => {
      // Agrupa ráfagas (p. ej. una venta con varios productos) en una sola revalidación.
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: catalogKey }), 300)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [queryClient])
}

export function useRealtimeStatus() {
  return useSyncExternalStore(onRealtimeStatusChange, getRealtimeStatus, getRealtimeStatus)
}
