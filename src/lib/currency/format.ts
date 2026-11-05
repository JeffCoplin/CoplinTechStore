const dopFormatter = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formatea un importe en pesos dominicanos (RD$). */
export function formatDOP(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return dopFormatter.format(Number.isFinite(n) ? n : 0)
}

/** Convierte a centavos enteros para evitar errores de coma flotante. */
export function toCents(value: number | string): number {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return 0
  // toPrecision corrige representaciones como 267.49999999999997 antes de redondear,
  // para coincidir con el redondeo de numeric(12,2) en PostgreSQL.
  const scaled = Number((Math.abs(n) * 100).toPrecision(15))
  return Math.sign(n) * Math.round(scaled)
}

export function fromCents(cents: number): number {
  return cents / 100
}

/** Redondea a 2 decimales con aritmética de centavos. */
export function roundMoney(value: number): number {
  return fromCents(toCents(value))
}

/** Interpreta texto de un input monetario ("1,250.50" o "1250.5"). */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/,/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? roundMoney(n) : null
}
