import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import { slugify, SLUG_PATTERN } from './slug'
import { buildWhatsappLink, normalizeWhatsappNumber } from './whatsapp'

describe('slugify', () => {
  it('genera slugs válidos para la BD', () => {
    expect(slugify('Audífonos Bluetooth Pro 2')).toBe('audifonos-bluetooth-pro-2')
    expect(slugify('  ¡Cargador   USB-C!  ')).toBe('cargador-usb-c')
    expect(SLUG_PATTERN.test(slugify('Ñandú & Co.'))).toBe(true)
  })
})

describe('csv', () => {
  it('escapa comillas, comas y fórmulas', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=SUM(A1)', -5]])
    expect(csv).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),-5')
  })
})

describe('whatsapp', () => {
  it('oculta el enlace si no hay número configurado', () => {
    expect(buildWhatsappLink(null, 'X', 'https://a')).toBeNull()
    expect(buildWhatsappLink('', 'X', 'https://a')).toBeNull()
    expect(buildWhatsappLink('123', 'X', 'https://a')).toBeNull()
  })

  it('construye el enlace con mensaje prellenado', () => {
    const link = buildWhatsappLink(normalizeWhatsappNumber('+1 (809) 000-0000'), 'Mouse', 'https://t/catalogo/mouse')
    expect(link).toMatch(/^https:\/\/wa\.me\/18090000000\?text=/)
    expect(decodeURIComponent(link!.split('text=')[1]!)).toContain('Mouse')
  })
})
