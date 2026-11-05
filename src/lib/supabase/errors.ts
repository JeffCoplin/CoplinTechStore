interface PgLikeError {
  message?: string
  code?: string
  hint?: string | null
  details?: string | null
}

const CODE_MESSAGES: Record<string, string> = {
  '42501': 'No tienes permiso para realizar esta acción.',
  '23505': 'Ya existe un registro con ese valor (nombre, slug, SKU o código).',
  '23503': 'No se puede completar: el registro está relacionado con otros datos.',
  '23001': 'No se puede eliminar: el registro está relacionado con otros datos.',
  '23514': 'Algún valor no cumple las reglas permitidas.',
  PGRST301: 'Tu sesión expiró. Inicia sesión nuevamente.',
  PGRST303: 'Tu sesión expiró. Inicia sesión nuevamente.',
}

/**
 * Traduce errores de Supabase/PostgreSQL a mensajes comprensibles sin filtrar
 * detalles internos. Los mensajes P0001/P0002/22023 provienen de nuestras
 * funciones SQL y ya están redactados para el usuario.
 */
export function toUserMessage(error: unknown, fallback = 'Ocurrió un error inesperado. Intenta nuevamente.'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  const e = error as PgLikeError
  if (e.code && ['P0001', 'P0002', '22023'].includes(e.code) && e.message) return e.message
  if (e.code && CODE_MESSAGES[e.code]) return CODE_MESSAGES[e.code] as string
  if (e.message && /Failed to fetch|NetworkError|fetch failed|Load failed/i.test(e.message)) {
    return 'No hay conexión con el servidor. Verifica tu internet e intenta de nuevo.'
  }
  if (e.message === 'Invalid login credentials') return 'Correo o contraseña incorrectos.'
  return fallback
}

export function errorHint(error: unknown): string | null {
  if (error && typeof error === 'object' && 'hint' in error) {
    const hint = (error as PgLikeError).hint
    return typeof hint === 'string' ? hint : null
  }
  return null
}
