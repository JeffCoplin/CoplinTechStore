export type Availability = 'available' | 'low_stock' | 'out_of_stock'

/**
 * Misma regla que public.availability_status() en PostgreSQL.
 * En el catálogo el estado siempre viene calculado por la base de datos;
 * esta versión solo se usa en el panel privado para mostrar el estado en vivo.
 */
export function availabilityFor(stock: number, threshold: number): Availability {
  if (stock <= 0) return 'out_of_stock'
  if (stock <= threshold) return 'low_stock'
  return 'available'
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Disponible',
  low_stock: 'Pocas unidades',
  out_of_stock: 'Agotado',
}

export function isAvailability(value: unknown): value is Availability {
  return value === 'available' || value === 'low_stock' || value === 'out_of_stock'
}
