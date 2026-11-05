import { fromCents, toCents } from '@/lib/currency/format'
import type { PaymentMethod } from './payments'

export interface CartLine {
  productId: string
  name: string
  sku: string | null
  unitPrice: number
  quantity: number
  /** Existencia conocida al añadir (solo para avisos; la BD valida de nuevo). */
  stock: number
}

export interface CartTotals {
  subtotal: number
  discount: number
  total: number
  change: number
}

export interface CartValidation {
  ok: boolean
  errors: string[]
}

/**
 * Vista previa de totales en el navegador. Es solo informativa:
 * create_sale recalcula precios, subtotal, total y cambio en la base de datos.
 */
export function computeCartTotals(lines: CartLine[], discount: number, amountReceived: number | null, method: PaymentMethod): CartTotals {
  const subtotalCents = lines.reduce((acc, l) => acc + toCents(l.unitPrice) * l.quantity, 0)
  const discountCents = Math.max(0, toCents(discount))
  const totalCents = Math.max(0, subtotalCents - discountCents)
  const receivedCents = method === 'cash' ? toCents(amountReceived ?? 0) : totalCents
  const changeCents = method === 'cash' ? Math.max(0, receivedCents - totalCents) : 0
  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    total: fromCents(totalCents),
    change: fromCents(changeCents),
  }
}

export function isValidQuantity(q: number): boolean {
  return Number.isInteger(q) && q > 0 && q <= 100_000
}

export function validateCart(
  lines: CartLine[],
  discount: number,
  amountReceived: number | null,
  method: PaymentMethod,
): CartValidation {
  const errors: string[] = []
  if (lines.length === 0) errors.push('Añade al menos un producto.')
  for (const l of lines) {
    if (!isValidQuantity(l.quantity)) errors.push(`Cantidad inválida para "${l.name}".`)
    else if (l.quantity > l.stock) errors.push(`Existencia insuficiente para "${l.name}" (disponible: ${l.stock}).`)
  }
  const subtotalCents = lines.reduce((acc, l) => acc + toCents(l.unitPrice) * l.quantity, 0)
  const discountCents = toCents(discount)
  if (!Number.isFinite(discount) || discountCents < 0) errors.push('El descuento no puede ser negativo.')
  else if (discountCents > subtotalCents) errors.push('El descuento no puede ser mayor que el subtotal.')
  if (method === 'cash') {
    const totalCents = subtotalCents - Math.max(0, discountCents)
    if (amountReceived === null || !Number.isFinite(amountReceived)) errors.push('Indica el importe recibido.')
    else if (toCents(amountReceived) < totalCents) errors.push('El importe recibido es menor que el total.')
  }
  return { ok: errors.length === 0, errors }
}

/** Añade un producto o incrementa su cantidad. */
export function addToCart(lines: CartLine[], item: Omit<CartLine, 'quantity'>, qty = 1): CartLine[] {
  const existing = lines.find((l) => l.productId === item.productId)
  if (existing) {
    return lines.map((l) => (l.productId === item.productId ? { ...l, quantity: l.quantity + qty, stock: item.stock } : l))
  }
  return [...lines, { ...item, quantity: qty }]
}

export function setLineQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.productId !== productId)
  return lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.floor(quantity) } : l))
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.productId !== productId)
}

/** Payload mínimo que se envía a create_sale: sin precios ni totales. */
export function toSaleItemsPayload(lines: CartLine[]): { product_id: string; quantity: number }[] {
  return lines.map((l) => ({ product_id: l.productId, quantity: l.quantity }))
}
