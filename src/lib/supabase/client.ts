import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { readSupabaseEnv } from './env'

const env = readSupabaseEnv()

export const isSupabaseConfigured = env !== null

/**
 * Cliente único de Supabase. Si faltan variables de entorno se crea contra una URL
 * local para que la app muestre el aviso de configuración en vez de fallar al importar.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env?.url ?? 'http://localhost:54321',
  env?.publishableKey ?? 'missing-key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  },
)

export const PRODUCT_IMAGES_BUCKET = 'product-images'

export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
