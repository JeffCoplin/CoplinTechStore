import { useQuery } from '@tanstack/react-query'
import type { Period } from '@/lib/dates/santo-domingo'
import { supabase } from '@/lib/supabase/client'

/**
 * Consultas agregadas calculadas en PostgreSQL (America/Santo_Domingo, solo
 * ventas completadas y gastos vigentes). Dashboard y reportes usan las mismas
 * funciones para que sus cifras coincidan.
 */

const n = (v: unknown) => Number(v ?? 0)

export interface Summary {
  grossSales: number
  discountTotal: number
  netSales: number
  costOfGoods: number
  grossProfit: number
  expensesTotal: number
  operatingResult: number
  salesCount: number
  averageTicket: number
}

const EMPTY_SUMMARY: Summary = {
  grossSales: 0,
  discountTotal: 0,
  netSales: 0,
  costOfGoods: 0,
  grossProfit: 0,
  expensesTotal: 0,
  operatingResult: 0,
  salesCount: 0,
  averageTicket: 0,
}

export async function fetchSummary(period: Period): Promise<Summary> {
  const { data, error } = await supabase.rpc('report_summary', { p_start: period.start, p_end: period.end })
  if (error) throw error
  const r = data?.[0]
  if (!r) return EMPTY_SUMMARY
  return {
    grossSales: n(r.gross_sales),
    discountTotal: n(r.discount_total),
    netSales: n(r.net_sales),
    costOfGoods: n(r.cost_of_goods),
    grossProfit: n(r.gross_profit),
    expensesTotal: n(r.expenses_total),
    operatingResult: n(r.operating_result),
    salesCount: n(r.sales_count),
    averageTicket: n(r.average_ticket),
  }
}

export function useSummary(period: Period, scope = 'reports') {
  return useQuery({ queryKey: [scope, 'summary', period], queryFn: () => fetchSummary(period) })
}

export function useSalesByDay(period: Period, scope = 'reports') {
  return useQuery({
    queryKey: [scope, 'by-day', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_sales_by_day', { p_start: period.start, p_end: period.end })
      if (error) throw error
      return (data ?? []).map((d) => ({ day: String(d.day).slice(0, 10), netSales: n(d.net_sales), grossProfit: n(d.gross_profit), salesCount: n(d.sales_count) }))
    },
  })
}

export function useProductPerformance(period: Period, scope = 'reports') {
  return useQuery({
    queryKey: [scope, 'products', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_product_performance', { p_start: period.start, p_end: period.end })
      if (error) throw error
      return (data ?? []).map((p) => ({
        productId: p.product_id,
        name: p.product_name,
        sku: p.sku,
        units: n(p.units),
        netAmount: n(p.net_amount),
        costAmount: n(p.cost_amount),
        grossProfit: n(p.gross_profit),
      }))
    },
  })
}

export function usePaymentMethods(period: Period, scope = 'reports') {
  return useQuery({
    queryKey: [scope, 'methods', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_payment_methods', { p_start: period.start, p_end: period.end })
      if (error) throw error
      return (data ?? []).map((m) => ({ method: m.payment_method, count: n(m.sales_count), netSales: n(m.net_sales) }))
    },
  })
}

export function useExpensesByCategory(period: Period, scope = 'reports') {
  return useQuery({
    queryKey: [scope, 'expenses', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_expenses_by_category', { p_start: period.start, p_end: period.end })
      if (error) throw error
      return (data ?? []).map((e) => ({ category: e.category, count: n(e.expense_count), total: n(e.total) }))
    },
  })
}

export function useInventoryCounts() {
  return useQuery({
    queryKey: ['dashboard', 'inventory-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('inventory_status_counts')
      if (error) throw error
      const r = data?.[0]
      return { available: n(r?.available), lowStock: n(r?.low_stock), outOfStock: n(r?.out_of_stock) }
    },
  })
}

/** Variación porcentual; null si no hay base de comparación. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
