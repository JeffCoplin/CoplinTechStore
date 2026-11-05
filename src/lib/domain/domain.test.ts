import { describe, expect, it } from 'vitest'
import { formatDOP, parseMoneyInput, roundMoney, toCents } from '@/lib/currency/format'
import { availabilityFor, AVAILABILITY_LABELS } from './availability'
import { addToCart, computeCartTotals, removeLine, setLineQuantity, toSaleItemsPayload, validateCart, type CartLine } from './cart'
import { validateMovement } from './inventory'

const line = (over: Partial<CartLine> = {}): CartLine => ({
  productId: 'p1',
  name: 'Audífonos',
  sku: 'AUD-1',
  unitPrice: 1250.5,
  quantity: 1,
  stock: 5,
  ...over,
})

describe('moneda DOP', () => {
  it('formatea con Intl es-DO / DOP', () => {
    const expected = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(1234.5)
    expect(formatDOP(1234.5)).toBe(expected)
    expect(formatDOP('99.9')).toBe(new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(99.9))
    expect(formatDOP(null)).toBe(formatDOP(0))
  })

  it('evita errores de coma flotante usando centavos', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(roundMoney(2.675)).toBe(2.68)
    expect(roundMoney(-2.675)).toBe(-2.68)
  })

  it('interpreta entradas monetarias', () => {
    expect(parseMoneyInput('1,250.50')).toBe(1250.5)
    expect(parseMoneyInput('RD$ 300')).toBe(300)
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('abc')).toBeNull()
  })
})

describe('disponibilidad', () => {
  it('calcula estados según existencia y umbral', () => {
    expect(availabilityFor(0, 2)).toBe('out_of_stock')
    expect(availabilityFor(1, 2)).toBe('low_stock')
    expect(availabilityFor(2, 2)).toBe('low_stock')
    expect(availabilityFor(3, 2)).toBe('available')
    expect(availabilityFor(1, 0)).toBe('available')
  })

  it('tiene etiquetas en español', () => {
    expect(AVAILABILITY_LABELS.available).toBe('Disponible')
    expect(AVAILABILITY_LABELS.low_stock).toBe('Pocas unidades')
    expect(AVAILABILITY_LABELS.out_of_stock).toBe('Agotado')
  })
})

describe('carrito / POS', () => {
  it('calcula subtotal, descuento, total y cambio en efectivo', () => {
    const lines = [line({ quantity: 2 }), line({ productId: 'p2', unitPrice: 0.1, quantity: 3 })]
    const t = computeCartTotals(lines, 100, 3000, 'cash')
    expect(t.subtotal).toBe(2501.3)
    expect(t.discount).toBe(100)
    expect(t.total).toBe(2401.3)
    expect(t.change).toBe(598.7)
  })

  it('para tarjeta y transferencia el cambio es cero', () => {
    expect(computeCartTotals([line()], 0, null, 'card').change).toBe(0)
    expect(computeCartTotals([line()], 0, 99999, 'bank_transfer').change).toBe(0)
  })

  it('rechaza descuento negativo o mayor que el subtotal', () => {
    expect(validateCart([line()], -1, null, 'card').errors).toContain('El descuento no puede ser negativo.')
    expect(validateCart([line()], 2000, null, 'card').errors).toContain('El descuento no puede ser mayor que el subtotal.')
    expect(validateCart([line()], 1250.5, null, 'card').ok).toBe(true)
  })

  it('exige importe recibido suficiente en efectivo', () => {
    expect(validateCart([line()], 0, 1000, 'cash').ok).toBe(false)
    expect(validateCart([line()], 0, null, 'cash').ok).toBe(false)
    expect(validateCart([line()], 0, 1250.5, 'cash').ok).toBe(true)
  })

  it('rechaza cantidades inválidas y existencia insuficiente', () => {
    expect(validateCart([line({ quantity: 0 })], 0, null, 'card').ok).toBe(false)
    expect(validateCart([line({ quantity: 1.5 })], 0, null, 'card').ok).toBe(false)
    expect(validateCart([line({ quantity: 6 })], 0, null, 'card').ok).toBe(false)
    expect(validateCart([], 0, null, 'card').ok).toBe(false)
  })

  it('agrupa, modifica y elimina líneas', () => {
    let lines = addToCart([], line())
    lines = addToCart(lines, line(), 2)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.quantity).toBe(3)
    lines = setLineQuantity(lines, 'p1', 1)
    expect(lines[0]?.quantity).toBe(1)
    expect(setLineQuantity(lines, 'p1', 0)).toHaveLength(0)
    expect(removeLine(lines, 'p1')).toHaveLength(0)
  })

  it('el payload de venta no incluye precios ni totales', () => {
    expect(toSaleItemsPayload([line({ quantity: 2 })])).toEqual([{ product_id: 'p1', quantity: 2 }])
  })
})

describe('reglas de inventario', () => {
  it('valida entradas y ajustes', () => {
    expect(validateMovement({ type: 'restock', delta: 5, reason: '' }, 0)).toBeNull()
    expect(validateMovement({ type: 'restock', delta: -1, reason: '' }, 10)).toMatch(/positiva/)
    expect(validateMovement({ type: 'adjustment', delta: -1, reason: ' ' }, 10)).toMatch(/motivo/)
    expect(validateMovement({ type: 'adjustment', delta: -11, reason: 'Daño' }, 10)).toMatch(/negativo/)
    expect(validateMovement({ type: 'adjustment', delta: 0, reason: 'x' }, 10)).toMatch(/distinto de cero/)
    expect(validateMovement({ type: 'adjustment', delta: 2.5, reason: 'x' }, 10)).toMatch(/entero/)
  })
})
