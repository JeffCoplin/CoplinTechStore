export const STORE_TIMEZONE = 'America/Santo_Domingo'

/** Fecha local (YYYY-MM-DD) en Santo Domingo para un instante dado. */
export function toLocalDateString(date: Date = new Date()): string {
  // en-CA produce YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parseIso(isoDate: string): [number, number, number] {
  const [y, m, d] = isoDate.split('-').map(Number)
  return [y ?? 1970, m ?? 1, d ?? 1]
}

/** Suma días a una fecha YYYY-MM-DD sin pasar por la zona horaria del navegador. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = parseIso(isoDate)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function daysBetweenInclusive(start: string, end: string): number {
  const [y1, m1, d1] = parseIso(start)
  const [y2, m2, d2] = parseIso(end)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) + 1
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = parseIso(value)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export type PeriodPreset = 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom'

export interface Period {
  start: string
  end: string
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hoy',
  last7: 'Últimos 7 días',
  thisMonth: 'Este mes',
  lastMonth: 'Mes anterior',
  custom: 'Rango personalizado',
}

/** Calcula los límites (fechas locales inclusivas) de un período predefinido. */
export function resolvePeriod(preset: Exclude<PeriodPreset, 'custom'>, now: Date = new Date()): Period {
  const today = toLocalDateString(now)
  const monthStart = `${today.slice(0, 7)}-01`
  switch (preset) {
    case 'today':
      return { start: today, end: today }
    case 'last7':
      return { start: addDays(today, -6), end: today }
    case 'thisMonth':
      return { start: monthStart, end: today }
    case 'lastMonth': {
      const end = addDays(monthStart, -1)
      return { start: `${end.slice(0, 7)}-01`, end }
    }
  }
}

/** Período anterior equivalente (misma cantidad de días, inmediatamente antes). */
export function previousPeriod(period: Period): Period {
  const len = daysBetweenInclusive(period.start, period.end)
  const end = addDays(period.start, -1)
  return { start: addDays(end, -(len - 1)), end }
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-DO', {
  timeZone: STORE_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('es-DO', {
  timeZone: STORE_TIMEZONE,
  dateStyle: 'medium',
})

const shortDayFormatter = new Intl.DateTimeFormat('es-DO', {
  timeZone: STORE_TIMEZONE,
  day: 'numeric',
  month: 'short',
})

/** Fecha y hora de un timestamp (timestamptz) en Santo Domingo. */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value)
}

// Mediodía UTC = mismo día calendario en Santo Domingo (UTC-4): evita el error de un día.
function localNoon(isoDate: string): Date {
  const [y, m, d] = parseIso(isoDate)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

/** Formatea una fecha local YYYY-MM-DD sin desplazarla por UTC. */
export function formatLocalDate(isoDate: string): string {
  return dateFormatter.format(localNoon(isoDate))
}

/** Etiqueta corta de día (p. ej. "4 nov") para gráficas. */
export function formatShortDay(isoDate: string): string {
  return shortDayFormatter.format(localNoon(isoDate))
}

/** Inicio del día local como ISO UTC, para filtrar columnas timestamptz. */
export function localDayStartIso(isoDate: string): string {
  // República Dominicana usa UTC-4 todo el año (sin horario de verano).
  const [y, m, d] = parseIso(isoDate)
  return new Date(Date.UTC(y, m - 1, d, 4)).toISOString()
}
