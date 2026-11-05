import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE } from '@/components/shared/Pagination'
import type { Period } from '@/lib/dates/santo-domingo'
import { supabase } from '@/lib/supabase/client'
import type { ExpenseValues } from './schema'

const expensesKey = ['expenses'] as const

export interface ExpenseFilters {
  period: Period
  category: string
  includeVoided: boolean
  page: number
}

export function buildExpensesQuery(f: Omit<ExpenseFilters, 'page'>) {
  let q = supabase
    .from('expenses')
    .select('id, expense_date, category, description, amount, payment_method, note, is_voided, created_at, updated_at', { count: 'exact' })
    .gte('expense_date', f.period.start)
    .lte('expense_date', f.period.end)
  if (f.category !== 'all') q = q.eq('category', f.category)
  if (!f.includeVoided) q = q.eq('is_voided', false)
  return q.order('expense_date', { ascending: false }).order('created_at', { ascending: false })
}

export function useExpenses(f: ExpenseFilters) {
  return useQuery({
    queryKey: [...expensesKey, f],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = f.page * PAGE_SIZE
      const { data, error, count } = await buildExpensesQuery(f).range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: data, total: count ?? 0 }
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: expensesKey })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['reports'] })
  }
}

export function useSaveExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ExpenseValues }) => {
      const { error } = id ? await supabase.from('expenses').update(values).eq('id', id) : await supabase.from('expenses').insert(values)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useVoidExpense() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').update({ is_voided: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
