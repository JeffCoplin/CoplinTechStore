import { formatDOP, fromCents, toCents } from '@/lib/currency/format'

/**
 * Carrito de consulta del catálogo público. Vive solo en el navegador del
 * visitante: no crea pedidos, no cobra y no reserva existencias. Sirve para
 * armar una lista y enviarla por WhatsApp.
 */

export const MAX_CART_LINES = 30
export const MAX_LINE_QUANTITY = 20

export interface CartItem {
  slug: string
  name: string
  /** Precio de venta visto en el catálogo (se refresca contra la BD al abrir el carrito). */
  price: number
  imagePath: string | null
  quantity: number
  /** Disponibilidad pública más reciente conocida. */
  availability: string
}

export type CartProduct = Omit<CartItem, 'quantity'>

export function clampQuantity(q: number): number {
  if (!Number.isFinite(q)) return 1
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(q)))
}

export function addItem(items: CartItem[], product: CartProduct, qty = 1): CartItem[] {
  const existing = items.find((i) => i.slug === product.slug)
  if (existing) {
    return items.map((i) => (i.slug === product.slug ? { ...i, ...product, quantity: clampQuantity(i.quantity + qty) } : i))
  }
  if (items.length >= MAX_CART_LINES) return items
  return [...items, { ...product, quantity: clampQuantity(qty) }]
}

export function setQuantity(items: CartItem[], slug: string, qty: number): CartItem[] {
  if (qty <= 0) return removeItem(items, slug)
  return items.map((i) => (i.slug === slug ? { ...i, quantity: clampQuantity(qty) } : i))
}

export function removeItem(items: CartItem[], slug: string): CartItem[] {
  return items.filter((i) => i.slug !== slug)
}

/** Solo las líneas que se pueden consultar (las agotadas no se envían). */
export function sendableItems(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.availability !== 'out_of_stock')
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + i.quantity, 0)
}

export function cartTotal(items: CartItem[]): number {
  return fromCents(items.reduce((acc, i) => acc + toCents(i.price) * i.quantity, 0))
}

/**
 * Aplica los datos actuales del catálogo. Los productos que ya no están
 * publicados se devuelven en `removed`.
 */
export function refreshItems(items: CartItem[], fresh: CartProduct[]): { items: CartItem[]; removed: CartItem[]; changed: boolean } {
  const bySlug = new Map(fresh.map((p) => [p.slug, p]))
  const removed = items.filter((i) => !bySlug.has(i.slug))
  let changed = removed.length > 0
  const next = items
    .filter((i) => bySlug.has(i.slug))
    .map((i) => {
      const p = bySlug.get(i.slug)!
      if (p.price !== i.price || p.availability !== i.availability || p.name !== i.name || p.imagePath !== i.imagePath) changed = true
      return { ...i, ...p }
    })
  return { items: next, removed, changed }
}

/** Sanea el contenido leído de localStorage (puede estar corrupto o manipulado). */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    const items: CartItem[] = []
    for (const d of data) {
      if (!d || typeof d !== 'object') continue
      const o = d as Record<string, unknown>
      if (typeof o.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.slug) || typeof o.name !== 'string') continue
      const price = Number(o.price)
      if (!Number.isFinite(price) || price <= 0) continue
      items.push({
        slug: o.slug,
        name: o.name.slice(0, 160),
        price,
        imagePath: typeof o.imagePath === 'string' ? o.imagePath : null,
        quantity: clampQuantity(Number(o.quantity)),
        availability: typeof o.availability === 'string' ? o.availability : 'available',
      })
      if (items.length >= MAX_CART_LINES) break
    }
    return items
  } catch {
    return []
  }
}

/** Texto prellenado para WhatsApp. Si es muy largo, omite los enlaces. */
export function buildCartMessage(items: CartItem[], origin: string, storeName = 'CoplinTech'): string {
  const lines = sendableItems(items)
  const build = (withLinks: boolean) =>
    [
      `Hola ${storeName}, me interesan estos productos del catálogo:`,
      '',
      ...lines.flatMap((i) => [
        `• ${i.quantity} × ${i.name} — ${formatDOP(i.price)} c/u`,
        ...(withLinks ? [`  ${origin}/catalogo/${i.slug}`] : []),
      ]),
      '',
      `Total estimado: ${formatDOP(cartTotal(lines))}`,
      '¿Me confirman disponibilidad? Gracias.',
    ].join('\n')
  const full = build(true)
  return full.length <= 1800 ? full : build(false)
}

export function buildCartWhatsappLink(number: string | null | undefined, items: CartItem[], origin: string, storeName?: string): string | null {
  if (!number || !/^[0-9]{8,15}$/.test(number) || sendableItems(items).length === 0) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(buildCartMessage(items, origin, storeName))}`
}
