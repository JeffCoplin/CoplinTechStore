export interface SupabaseEnv {
  url: string
  publishableKey: string
}

/**
 * Lee la configuración pública de Supabase. Solo URL + clave publicable/anon:
 * la clave service_role NUNCA debe existir en variables VITE_*.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const publishableKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  if (!url || !publishableKey) return null
  return { url, publishableKey }
}
