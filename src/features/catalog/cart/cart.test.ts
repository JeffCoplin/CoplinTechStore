import { describe, expect, it } from 'vitest'
import { formatDOP } from '@/lib/currency/format'
import {
  addItem,
  buildCartMessage,
  buildCartWhatsappLink,
  cartCount,
  cartTotal,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  parseStoredCart,
  refreshItems,
  removeItem,
  setQuantity,
  type CartProduct,
} from './cart'

const p = (slug: string, price = 1000, availability = 'available'): CartProduct => ({ slug, name: `Producto ${slug}`, price, imagePath: null, availability })

describe('carrito de consulta', () => {
  it('agrega, suma cantidades y respeta los límites', () => {
    let items = addItem([], p('mouse'))
    items = addItem(items, p('mouse'), 2)
    expect(items).toHaveLength(1)
    expect(items[0]?.quantity).toBe(3)
    expect(addItem(items, p('mouse'), 100)[0]?.quantity).toBe(MAX_LINE_QUANTITY)
    let many: ReturnType<typeof addItem> = []
    for (let i = 0; i < MAX_CART_LINES + 5; i++) many = addItem(many, p(`p${i}`))
    expect(many).toHaveLength(MAX_CART_LINES)
  })

  it('modifica y elimina líneas', () => {
    const items = addItem(addItem([], p('a')), p('b'))
    expect(setQuantity(items, 'a', 4)[0]?.quantity).toBe(4)
    expect(setQuantity(items, 'a', 0)).toHaveLength(1)
    expect(removeItem(items, 'b').map((i) => i.slug)).toEqual(['a'])
  })

  it('calcula conteo y total en centavos', () => {
    const items = addItem(addItem([], p('a', 0.1), 3), p('b', 2800.5), 2)
    expect(cartCount(items)).toBe(5)
    expect(cartTotal(items)).toBe(5601.3)
  })

  it('refresca precio y disponibilidad y quita los no publicados', () => {
    const items = addItem(addItem([], p('a', 1000)), p('b'))
    const r = refreshItems(items, [p('a', 1200, 'low_stock')])
    expect(r.items).toEqual([expect.objectContaining({ slug: 'a', price: 1200, availability: 'low_stock', quantity: 1 })])
    expect(r.removed.map((i) => i.slug)).toEqual(['b'])
    expect(r.changed).toBe(true)
    expect(refreshItems(r.items, [p('a', 1200, 'low_stock')]).changed).toBe(false)
  })

  it('ignora datos corruptos o manipulados en localStorage', () => {
    expect(parseStoredCart('no-json')).toEqual([])
    expect(parseStoredCart('{"a":1}')).toEqual([])
    const parsed = parseStoredCart(
      JSON.stringify([{ slug: 'ok', name: 'Ok', price: 10, quantity: 999 }, { slug: '../hack', name: 'x', price: 1 }, { slug: 'neg', name: 'n', price: -5 }]),
    )
    expect(parsed).toEqual([expect.objectContaining({ slug: 'ok', quantity: MAX_LINE_QUANTITY, availability: 'available' })])
  })

  it('arma el mensaje sin productos agotados y con total estimado', () => {
    const items = addItem(addItem([], p('mouse', 2800), 2), p('teclado', 3500, 'out_of_stock'))
    const msg = buildCartMessage(items, 'https://tienda.test')
    expect(msg).toContain(`• 2 × Producto mouse — ${formatDOP(2800)} c/u`)
    expect(msg).toContain('https://tienda.test/catalogo/mouse')
    expect(msg).not.toContain('teclado')
    expect(msg).toContain(`Total estimado: ${formatDOP(5600)}`)
  })

  it('omite enlaces si el mensaje es muy largo', () => {
    let items: ReturnType<typeof addItem> = []
    for (let i = 0; i < 25; i++) items = addItem(items, { ...p(`producto-con-nombre-largo-${i}`), name: `Teclado mecánico con nombre largo número ${i}` })
    const msg = buildCartMessage(items, 'https://coplintech.vercel.app')
    expect(msg).not.toContain('/catalogo/')
    expect(msg).toContain('Total estimado')
  })

  it('sin número de WhatsApp o sin productos disponibles no hay enlace', () => {
    const items = addItem([], p('a'))
    expect(buildCartWhatsappLink(null, items, 'https://t')).toBeNull()
    expect(buildCartWhatsappLink('18090000000', [], 'https://t')).toBeNull()
    expect(buildCartWhatsappLink('18090000000', addItem([], p('x', 1, 'out_of_stock')), 'https://t')).toBeNull()
    expect(buildCartWhatsappLink('18090000000', items, 'https://t')).toMatch(/^https:\/\/wa\.me\/18090000000\?text=/)
  })
})
