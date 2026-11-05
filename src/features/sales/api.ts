import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/components/shared/Pagination'
import { addDays, localDayStartIso, type Period } from '@/lib/dates/santo-domingo'
import type { PaymentMethod } from '@/lib/domain/payments'
import { supabase } from '@/lib/supabase/client'

export const salesKey = ['sales'] as const

export interface SalesFilters {
  search: string
  period: Period
  status: 'all' | 'completed' | 'voided'
  method: 'all' | PaymentMethod
  page: number
}

const SALE_LIST_COLUMNS = 'id, sale_number, status, payment_method, subtotal, discount_amount, total, created_at'

export function buildSalesQuery(f: Omit<SalesFilters, 'page'>) {
  let q = supabase
    .from('sales')
    .select(SALE_LIST_COLUMNS, { count: 'exact' })
    .gte('created_at', localDayStartIso(f.period.start))
    .lt('created_at', localDayStartIso(addDays(f.period.end, 1)))
  const term = f.search.trim().toUpperCase()
  if (term) q = q.ilike('sale_number', `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
  if (f.status !== 'all') q = q.eq('status', f.status)
  if (f.method !== 'all') q = q.eq('payment_method', f.method)
  return q.order('created_at', { ascending: false })
}

export function useSales(f: SalesFilters) {
  return useQuery({
    queryKey: [...salesKey, 'list', f],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = f.page * PAGE_SIZE
      const { data, error, count } = await buildSalesQuery(f).range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data, total: count ?? 0 }
    },
  })
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: [...salesKey, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_sale_price, unit_cost_price, line_subtotal)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type SaleDetail = NonNullable<ReturnType<typeof useSale>['data']>

export interface CreateSaleInput {
  clientRequestId: string
  items: { product_id: string; quantity: number }[]
  paymentMethod: PaymentMethod
  discount: number
  amountReceived: number | null
  note: string
}

function invalidateAfterSale(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: salesKey })
  void qc.invalidateQueries({ queryKey: ['products'] })
  void qc.invalidateQueries({ queryKey: ['stock-movements'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
  void qc.invalidateQueries({ queryKey: ['reports'] })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data, error } = await supabase.rpc('create_sale', {
        p_client_request_id: input.clientRequestId,
        p_items: input.items,
        p_payment_method: input.paymentMethod,
        p_discount_amount: input.discount,
        p_amount_received: input.paymentMethod === 'cash' ? input.amountReceived : null,
        p_note: input.note.trim() || null,
      })
      if (error) throw error
      const row = data?.[0]
      if (!row) throw new Error('La venta no devolvió resultado')
      return row
    },
    onSuccess: () => invalidateAfterSale(qc),
  })
}

export function useVoidSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_reason: reason })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateAfterSale(qc),
  })
}
