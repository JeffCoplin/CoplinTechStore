import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/components/shared/Pagination'
import { localDayStartIso, addDays, type Period } from '@/lib/dates/santo-domingo'
import type { ManualMovementType } from '@/lib/domain/inventory'
import { supabase } from '@/lib/supabase/client'

const movementsKey = ['stock-movements'] as const

export interface MovementFilters {
  productId: string | null
  type: string
  period: Period
  page: number
}

export function useStockMovements(f: MovementFilters) {
  return useQuery({
    queryKey: [...movementsKey, f],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from('stock_movements')
        .select('id, product_id, movement_type, quantity_delta, quantity_before, quantity_after, sale_id, reason, created_at, products(name, sku), sales(sale_number)', {
          count: 'exact',
        })
        .gte('created_at', localDayStartIso(f.period.start))
        .lt('created_at', localDayStartIso(addDays(f.period.end, 1)))
      if (f.productId) q = q.eq('product_id', f.productId)
      if (f.type !== 'all') q = q.eq('movement_type', f.type as 'restock')
      const from = f.page * PAGE_SIZE
      const { data, error, count } = await q.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data, total: count ?? 0 }
    },
  })
}

export function useRestockList() {
  return useQuery({
    queryKey: ['products', 'restock'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('products_needing_restock', { p_limit: 200 })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRecordMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { productId: string; type: ManualMovementType; delta: number; reason: string }) => {
      const { data, error } = await supabase.rpc('record_stock_movement', {
        p_product_id: args.productId,
        p_movement_type: args.type,
        p_quantity_delta: args.delta,
        p_reason: args.reason.trim() || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: movementsKey })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
