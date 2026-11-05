import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetweenInclusive,
  formatLocalDate,
  isValidIsoDate,
  localDayStartIso,
  previousPeriod,
  resolvePeriod,
  toLocalDateString,
} from './santo-domingo'

describe('fechas en America/Santo_Domingo', () => {
  it('usa el día local y no el día UTC', () => {
    // 2026-11-05 02:30 UTC = 2026-11-04 22:30 en Santo Domingo (UTC-4)
    expect(toLocalDateString(new Date('2026-11-05T02:30:00Z'))).toBe('2026-11-04')
    expect(toLocalDateString(new Date('2026-11-05T04:00:00Z'))).toBe('2026-11-05')
  })

  it('resuelve períodos predefinidos', () => {
    const now = new Date('2026-03-01T03:00:00Z') // 28 feb 23:00 local
    expect(resolvePeriod('today', now)).toEqual({ start: '2026-02-28', end: '2026-02-28' })
    expect(resolvePeriod('last7', now)).toEqual({ start: '2026-02-22', end: '2026-02-28' })
    expect(resolvePeriod('thisMonth', now)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(resolvePeriod('lastMonth', now)).toEqual({ start: '2026-01-01', end: '2026-01-31' })
  })

  it('mes anterior en enero cruza de año', () => {
    expect(resolvePeriod('lastMonth', new Date('2026-01-15T15:00:00Z'))).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('calcula el período anterior equivalente', () => {
    expect(previousPeriod({ start: '2026-02-22', end: '2026-02-28' })).toEqual({ start: '2026-02-15', end: '2026-02-21' })
    expect(previousPeriod({ start: '2026-03-01', end: '2026-03-01' })).toEqual({ start: '2026-02-28', end: '2026-02-28' })
  })

  it('aritmética de fechas', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(daysBetweenInclusive('2026-01-01', '2026-01-31')).toBe(31)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-02-28')).toBe(true)
  })

  it('el inicio del día local es 04:00 UTC', () => {
    expect(localDayStartIso('2026-11-04')).toBe('2026-11-04T04:00:00.000Z')
  })

  it('formatea fechas locales sin desplazarlas un día', () => {
    expect(formatLocalDate('2026-11-04')).toMatch(/4/)
  })
})
