import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

const settingsKey = ['store-settings'] as const

export function useStoreSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('id, store_name, whatsapp_number, currency_code, timezone, default_low_stock_threshold, updated_at')
        .eq('id', true)
        .single()
      if (error) throw error
      return data
    },
  })
}

export interface SettingsPatch {
  store_name: string
  whatsapp_number: string | null
  default_low_stock_threshold: number
}

export function useUpdateStoreSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: SettingsPatch) => {
      const { error } = await supabase.from('store_settings').update(patch).eq('id', true)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKey })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    },
  })
}
