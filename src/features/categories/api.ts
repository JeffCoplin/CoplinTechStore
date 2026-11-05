import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { CategoryValues } from './schema'

export const categoriesKey = ['categories'] as const

export function useCategories() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, sort_order, is_active, created_at, updated_at')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CategoryValues }) => {
      const query = id
        ? supabase.from('categories').update(values).eq('id', id)
        : supabase.from('categories').insert(values)
      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  })
}
