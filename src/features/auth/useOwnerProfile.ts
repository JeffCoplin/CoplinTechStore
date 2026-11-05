import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from './AuthProvider'

/**
 * Comprueba en la base de datos que el usuario autenticado tiene un
 * owner_profiles activo. La autorización real está en RLS/RPC; esto solo
 * decide qué mostrar.
 */
export function useOwnerProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['owner-profile', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('owner_profiles')
        .select('user_id, display_name, is_active')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data && data.is_active ? data : null
    },
  })
}
