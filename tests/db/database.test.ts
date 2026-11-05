import type { PGlite, Transaction } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { as, createTestDb, OWNER, pgError, seedUsers } from './harness'

let db: PGlite

beforeAll(async () => {
  db = await createTestDb()
  await seedUsers(db)
})

type Q = PGlite | Transaction

async function one<T>(q: Q, sql: string, params: unknown[] = []): Promise<T> {
  const r = await q.query<T>(sql, params)
  return r.rows[0] as T
}

let seq = 0
async function createProduct(
  over: Partial<{ stock: number; price: number; cost: number; threshold: number; active: boolean; published: boolean; name: string }> = {},
): Promise<{ id: string; slug: string }> {
  seq += 1
  const slug = `producto-${seq}`
  return as(db, 'owner', (tx) =>
    one<{ id: string; slug: string }>(
      tx,
      `insert into public.products (name, slug, sku, cost_price, sale_price, stock_quantity, low_stock_threshold, is_active, is_published)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id, slug`,
      [
        over.name ?? `Producto ${seq}`,
        slug,
        `SKU-${seq}`,
        over.cost ?? 600,
        over.price ?? 1000,
        over.stock ?? 5,
        over.threshold ?? 2,
        over.active ?? true,
        over.published ?? true,
      ],
    ),
  )
}

async function stockOf(id: string): Promise<number> {
  return (await one<{ s: number }>(db, 'select stock_quantity as s from public.products where id = $1', [id])).s
}

interface SaleArgs {
  items: { product_id: string; quantity: unknown }[]
  method?: string
  discount?: number
  received?: number | null
  requestId?: string
}

function createSale(q: Q, a: SaleArgs) {
  return one<{ sale_id: string; sale_number: string; total: string; change_amount: string; already_existed: boolean }>(
    q,
    'select * from public.create_sale($1, $2::jsonb, $3, $4, $5, $6)',
    [a.requestId ?? crypto.randomUUID(), JSON.stringify(a.items), a.method ?? 'card', a.discount ?? 0, a.received ?? null, null],
  )
}

describe('acceso anónimo', () => {
  it('no puede leer tablas privadas', async () => {
    for (const table of ['products', 'sales', 'sale_items', 'stock_movements', 'expenses', 'owner_profiles', 'store_settings', 'categories']) {
      const err = await pgError(as(db, 'anon', (tx) => tx.query(`select * from public.${table} limit 1`)))
      expect(err?.code, table).toBe('42501')
    }
  })

  it('no puede escribir ni ejecutar funciones privadas', async () => {
    const p = await createProduct()
    expect((await pgError(as(db, 'anon', (tx) => tx.query(`update public.products set sale_price = 1 where id = $1`, [p.id]))))?.code).toBe('42501')
    expect((await pgError(as(db, 'anon', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }] }))))?.code).toBe('42501')
    expect((await pgError(as(db, 'anon', (tx) => tx.query(`select * from public.report_summary('2026-01-01', '2026-12-31')`))))?.code).toBe('42501')
    expect((await pgError(as(db, 'anon', (tx) => tx.query(`select public.void_sale(gen_random_uuid(), 'x')`))))?.code).toBe('42501')
  })

  it('el catálogo público solo expone campos permitidos y productos visibles', async () => {
    const visible = await createProduct({ name: 'Visible', stock: 10, threshold: 2 })
    const low = await createProduct({ name: 'Pocas', stock: 1, threshold: 2 })
    const out = await createProduct({ name: 'Agotado', stock: 0 })
    const hidden = await createProduct({ name: 'Oculto', published: false })
    const inactive = await createProduct({ name: 'Inactivo', active: false })

    const rows = await as(db, 'anon', (tx) => tx.query<Record<string, unknown>>(`select * from public.get_public_catalog_products(null, null, 100, 0)`))
    const cols = Object.keys(rows.rows[0] ?? {}).sort()
    expect(cols).toEqual(['availability', 'brand', 'category_name', 'category_slug', 'description', 'image_path', 'name', 'sale_price', 'slug', 'total_count'])
    for (const forbidden of ['cost_price', 'stock_quantity', 'low_stock_threshold', 'id']) expect(cols).not.toContain(forbidden)

    const bySlug = new Map(rows.rows.map((r) => [r.slug as string, r]))
    expect(bySlug.get(visible.slug)?.availability).toBe('available')
    expect(bySlug.get(low.slug)?.availability).toBe('low_stock')
    expect(bySlug.get(out.slug)?.availability).toBe('out_of_stock')
    expect(bySlug.has(hidden.slug)).toBe(false)
    expect(bySlug.has(inactive.slug)).toBe(false)

    const detail = await as(db, 'anon', (tx) => tx.query(`select * from public.get_public_catalog_product_by_slug($1)`, [hidden.slug]))
    expect(detail.rows).toHaveLength(0)
  })

  it('la búsqueda pública escapa comodines', async () => {
    await createProduct({ name: 'Cable 100% cobre' })
    const r = await as(db, 'anon', (tx) => tx.query(`select name from public.get_public_catalog_products('100%', null, 100, 0)`))
    expect(r.rows.map((x) => (x as { name: string }).name)).toEqual(['Cable 100% cobre'])
    const none = await as(db, 'anon', (tx) => tx.query(`select name from public.get_public_catalog_products('%%%_', null, 100, 0)`))
    expect(none.rows).toHaveLength(0)
  })

  it('la información pública de tienda no incluye campos internos', async () => {
    const r = await as(db, 'anon', (tx) => tx.query<Record<string, unknown>>(`select * from public.get_public_store_info()`))
    expect(Object.keys(r.rows[0] ?? {}).sort()).toEqual(['store_name', 'whatsapp_number'])
    expect(r.rows[0]?.store_name).toBe('CoplinTech')
    expect(r.rows[0]?.whatsapp_number).toBeNull()
  })
})

describe('usuario autenticado sin perfil de propietario', () => {
  it('no ve datos privados', async () => {
    await createProduct()
    const r = await as(db, 'stranger', (tx) => tx.query(`select * from public.products`))
    expect(r.rows).toHaveLength(0)
    const s = await as(db, 'stranger', (tx) => tx.query(`select * from public.store_settings`))
    expect(s.rows).toHaveLength(0)
  })

  it('no puede crear, vender ni consultar reportes', async () => {
    const p = await createProduct()
    const ins = await pgError(as(db, 'stranger', (tx) => tx.query(`insert into public.products (name, slug, cost_price, sale_price) values ('x', 'x-stranger', 1, 2)`)))
    expect(ins?.code).toBe('42501')
    const sale = await pgError(as(db, 'stranger', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }] })))
    expect(sale?.code).toBe('42501')
    const rep = await pgError(as(db, 'stranger', (tx) => tx.query(`select * from public.report_summary('2026-01-01', '2026-01-31')`)))
    expect(rep?.code).toBe('42501')
    const mov = await pgError(as(db, 'stranger', (tx) => tx.query(`select public.record_stock_movement($1, 'restock', 5, null)`, [p.id])))
    expect(mov?.code).toBe('42501')
    expect(await stockOf(p.id)).toBe(5)
  })

  it('no puede autoasignarse como propietario', async () => {
    const err = await pgError(as(db, 'stranger', (tx) => tx.query(`insert into public.owner_profiles (user_id) values ($1)`, ['22222222-2222-4222-8222-222222222222'])))
    expect(err?.code).toBe('42501')
  })

  it('solo puede existir un propietario activo', async () => {
    const err = await pgError(db.query(`insert into public.owner_profiles (user_id) values ('22222222-2222-4222-8222-222222222222')`))
    expect(err?.code).toBe('23505')
  })
})

describe('productos e inventario', () => {
  it('el stock inicial crea un movimiento initial_stock', async () => {
    const p = await createProduct({ stock: 7 })
    const m = await one<{ movement_type: string; quantity_delta: number; quantity_before: number; quantity_after: number; created_by: string }>(
      db,
      'select * from public.stock_movements where product_id = $1',
      [p.id],
    )
    expect(m).toMatchObject({ movement_type: 'initial_stock', quantity_delta: 7, quantity_before: 0, quantity_after: 7, created_by: OWNER })
  })

  it('sin stock inicial no se crea movimiento', async () => {
    const p = await createProduct({ stock: 0 })
    const r = await db.query('select 1 from public.stock_movements where product_id = $1', [p.id])
    expect(r.rows).toHaveLength(0)
  })

  it('la edición normal no puede cambiar el stock', async () => {
    const p = await createProduct()
    const err = await pgError(as(db, 'owner', (tx) => tx.query(`update public.products set stock_quantity = 99 where id = $1`, [p.id])))
    expect(err?.code).toBe('42501')
    await as(db, 'owner', (tx) => tx.query(`update public.products set sale_price = 1200 where id = $1`, [p.id]))
    expect(await stockOf(p.id)).toBe(5)
  })

  it('el propietario no puede borrar productos', async () => {
    const p = await createProduct()
    const err = await pgError(as(db, 'owner', (tx) => tx.query(`delete from public.products where id = $1`, [p.id])))
    expect(err?.code).toBe('42501')
  })

  it('registra entradas y ajustes con validaciones', async () => {
    const p = await createProduct({ stock: 3 })
    await as(db, 'owner', (tx) => tx.query(`select public.record_stock_movement($1, 'restock', 4, 'Compra')`, [p.id]))
    expect(await stockOf(p.id)).toBe(7)
    await as(db, 'owner', (tx) => tx.query(`select public.record_stock_movement($1, 'adjustment', -2, 'Dañado')`, [p.id]))
    expect(await stockOf(p.id)).toBe(5)

    const noReason = await pgError(as(db, 'owner', (tx) => tx.query(`select public.record_stock_movement($1, 'adjustment', -1, '  ')`, [p.id])))
    expect(noReason?.message).toMatch(/motivo/)
    const negative = await pgError(as(db, 'owner', (tx) => tx.query(`select public.record_stock_movement($1, 'adjustment', -6, 'Error')`, [p.id])))
    expect(negative?.message).toMatch(/negativo/)
    const badRestock = await pgError(as(db, 'owner', (tx) => tx.query(`select public.record_stock_movement($1, 'restock', -1, null)`, [p.id])))
    expect(badRestock?.message).toMatch(/positiva/)
    const badType = await pgError(as(db, 'owner', (tx) => tx.query(`select public.record_stock_movement($1, 'sale', -1, 'x')`, [p.id])))
    expect(badType?.code).toBe('22023')
    expect(await stockOf(p.id)).toBe(5)

    const hist = await db.query<{ movement_type: string; quantity_before: number; quantity_after: number }>(
      'select movement_type, quantity_before, quantity_after from public.stock_movements where product_id = $1 order by created_at, quantity_before',
      [p.id],
    )
    expect(hist.rows.map((r) => r.movement_type).sort()).toEqual(['adjustment', 'initial_stock', 'restock'])
  })

  it('los movimientos son inmutables', async () => {
    const p = await createProduct()
    const err = await pgError(as(db, 'owner', (tx) => tx.query(`update public.stock_movements set reason = 'x' where product_id = $1`, [p.id])))
    expect(err?.code).toBe('42501')
    // Ni siquiera el superusuario puede alterarlos (trigger).
    const err2 = await pgError(db.query(`delete from public.stock_movements where product_id = $1`, [p.id]))
    expect(err2?.message).toMatch(/inmutables/)
  })
})

describe('ventas (create_sale)', () => {
  it('venta exitosa en efectivo: calcula en BD, descuenta stock y guarda snapshots', async () => {
    const a = await createProduct({ price: 1250.5, cost: 700, stock: 5, name: 'Audífonos' })
    const b = await createProduct({ price: 99.99, cost: 40, stock: 10 })
    const sale = await as(db, 'owner', (tx) =>
      createSale(tx, { items: [{ product_id: a.id, quantity: 2 }, { product_id: b.id, quantity: 3 }, { product_id: a.id, quantity: 1 }], method: 'cash', discount: 51.47, received: 4000 }),
    )
    expect(sale.sale_number).toMatch(/^CP-\d{6}$/)
    // 3 × 1250.50 + 3 × 99.99 − 51.47 = 4000.00
    expect(sale.total).toBe('4000.00')
    expect(sale.change_amount).toBe('0.00')
    expect(await stockOf(a.id)).toBe(2)
    expect(await stockOf(b.id)).toBe(7)

    const items = await db.query<{ product_name_snapshot: string; quantity: number; unit_sale_price: string; unit_cost_price: string; line_subtotal: string }>(
      'select * from public.sale_items where sale_id = $1 order by unit_sale_price desc',
      [sale.sale_id],
    )
    expect(items.rows).toHaveLength(2)
    expect(items.rows[0]).toMatchObject({ product_name_snapshot: 'Audífonos', quantity: 3, unit_sale_price: '1250.50', unit_cost_price: '700.00', line_subtotal: '3751.50' })

    const movs = await db.query<{ quantity_delta: number }>(`select quantity_delta from public.stock_movements where sale_id = $1 and movement_type = 'sale'`, [sale.sale_id])
    expect(movs.rows.map((m) => m.quantity_delta).sort()).toEqual([-3, -3])
  })

  it('admite cada método de pago; tarjeta y transferencia guardan recibido = total y cambio 0', async () => {
    const p = await createProduct({ stock: 10, price: 500 })
    for (const method of ['cash', 'bank_transfer', 'card']) {
      const s = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }], method, received: method === 'cash' ? 600 : 99999 }))
      const row = await one<{ payment_method: string; amount_received: string; change_amount: string }>(db, 'select * from public.sales where id = $1', [s.sale_id])
      expect(row.payment_method).toBe(method)
      if (method === 'cash') expect(row).toMatchObject({ amount_received: '600.00', change_amount: '100.00' })
      else expect(row).toMatchObject({ amount_received: '500.00', change_amount: '0.00' })
    }
    expect(await stockOf(p.id)).toBe(7)
  })

  it('rechaza stock insuficiente sin dejar rastros', async () => {
    const p = await createProduct({ stock: 2 })
    const before = await one<{ n: number }>(db, 'select count(*)::int as n from public.sales')
    const err = await pgError(as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 3 }] })))
    expect(err?.hint).toBe('insufficient_stock')
    expect(await stockOf(p.id)).toBe(2)
    expect((await one<{ n: number }>(db, 'select count(*)::int as n from public.sales')).n).toBe(before.n)
  })

  it('doble envío con la misma clave crea una sola venta y descuenta una sola vez', async () => {
    const p = await createProduct({ stock: 5 })
    const requestId = crypto.randomUUID()
    const first = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 2 }], requestId }))
    const second = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 2 }], requestId }))
    expect(second.sale_id).toBe(first.sale_id)
    expect(second.already_existed).toBe(true)
    expect(await stockOf(p.id)).toBe(3)
  })

  it('un fallo a mitad de la transacción no deja venta ni descuento parcial', async () => {
    const ok = await createProduct({ stock: 5 })
    const inactive = await createProduct({ stock: 5, active: false })
    const err = await pgError(as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: ok.id, quantity: 1 }, { product_id: inactive.id, quantity: 1 }] })))
    expect(err?.hint).toBe('inactive_product')
    expect(await stockOf(ok.id)).toBe(5)
    const movs = await db.query(`select 1 from public.stock_movements where product_id = $1 and movement_type = 'sale'`, [ok.id])
    expect(movs.rows).toHaveLength(0)
  })

  it('valida cantidades, descuento, recibido y método', async () => {
    const p = await createProduct({ stock: 5, price: 100 })
    const cases: [SaleArgs, RegExp][] = [
      [{ items: [{ product_id: p.id, quantity: 0 }] }, /enteras/],
      [{ items: [{ product_id: p.id, quantity: -1 }] }, /enteras/],
      [{ items: [{ product_id: p.id, quantity: 1.5 }] }, /enteras/],
      [{ items: [{ product_id: p.id, quantity: '1' }] }, /enteras/],
      [{ items: [{ product_id: 'no-es-uuid', quantity: 1 }] }, /enteras/],
      [{ items: [] }, /no tiene artículos/],
      [{ items: [{ product_id: p.id, quantity: 1 }], discount: -1 }, /negativo/],
      [{ items: [{ product_id: p.id, quantity: 1 }], discount: 100.01 }, /mayor que el subtotal/],
      [{ items: [{ product_id: p.id, quantity: 1 }], method: 'cash', received: 99.99 }, /recibido/],
      [{ items: [{ product_id: p.id, quantity: 1 }], method: 'cash', received: null }, /recibido/],
      [{ items: [{ product_id: p.id, quantity: 1 }], method: 'crypto' }, /Método de pago/],
      [{ items: [{ product_id: crypto.randomUUID(), quantity: 1 }] }, /no encontrado/],
    ]
    for (const [args, re] of cases) {
      const err = await pgError(as(db, 'owner', (tx) => createSale(tx, args)))
      expect(err?.message, JSON.stringify(args)).toMatch(re)
    }
    // Descuento igual al subtotal es válido (total 0).
    const free = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }], discount: 100 }))
    expect(Number(free.total)).toBe(0)
    expect(await stockOf(p.id)).toBe(4)
  })

  it('el navegador no puede imponer precios: se usan los de la BD', async () => {
    const p = await createProduct({ stock: 5, price: 300 })
    const s = await as(db, 'owner', (tx) =>
      one<{ total: string }>(tx, `select * from public.create_sale($1, $2::jsonb, 'card', 0, null, null)`, [
        crypto.randomUUID(),
        JSON.stringify([{ product_id: p.id, quantity: 1, unit_price: 1, total: 1 }]),
      ]),
    )
    expect(Number(s.total)).toBe(300)
  })

  it('los cambios posteriores de precio/costo no alteran los snapshots', async () => {
    const p = await createProduct({ stock: 5, price: 1000, cost: 600, name: 'Original' })
    const s = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }] }))
    await as(db, 'owner', (tx) => tx.query(`update public.products set sale_price = 5, cost_price = 1, name = 'Renombrado' where id = $1`, [p.id]))
    const item = await one<{ product_name_snapshot: string; unit_sale_price: string; unit_cost_price: string }>(db, 'select * from public.sale_items where sale_id = $1', [s.sale_id])
    expect(item).toMatchObject({ product_name_snapshot: 'Original', unit_sale_price: '1000.00', unit_cost_price: '600.00' })
    const err = await pgError(db.query(`update public.sale_items set unit_sale_price = 1 where sale_id = $1`, [s.sale_id]))
    expect(err?.message).toMatch(/inmutables/)
  })

  it('las ventas no se pueden borrar ni editar desde el cliente', async () => {
    const p = await createProduct()
    const s = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }] }))
    expect((await pgError(as(db, 'owner', (tx) => tx.query(`update public.sales set total = 0 where id = $1`, [s.sale_id]))))?.code).toBe('42501')
    expect((await pgError(as(db, 'owner', (tx) => tx.query(`delete from public.sales where id = $1`, [s.sale_id]))))?.code).toBe('42501')
    expect((await pgError(db.query(`delete from public.sales where id = $1`, [s.sale_id])))?.message).toMatch(/inmutables/)
  })
})

describe('anulación (void_sale)', () => {
  it('restaura stock, crea movimientos compensatorios y no permite anular dos veces', async () => {
    const p = await createProduct({ stock: 5 })
    const s = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 3 }] }))
    expect(await stockOf(p.id)).toBe(2)

    const noReason = await pgError(as(db, 'owner', (tx) => tx.query(`select public.void_sale($1, '')`, [s.sale_id])))
    expect(noReason?.message).toMatch(/motivo/)

    await as(db, 'owner', (tx) => tx.query(`select public.void_sale($1, 'Cliente devolvió')`, [s.sale_id]))
    expect(await stockOf(p.id)).toBe(5)
    const sale = await one<{ status: string; voided_by: string; void_reason: string; voided_at: string | null }>(db, 'select * from public.sales where id = $1', [s.sale_id])
    expect(sale).toMatchObject({ status: 'voided', voided_by: OWNER, void_reason: 'Cliente devolvió' })
    expect(sale.voided_at).not.toBeNull()

    const movs = await db.query<{ movement_type: string; quantity_delta: number }>(`select movement_type, quantity_delta from public.stock_movements where sale_id = $1 order by movement_type`, [s.sale_id])
    expect(movs.rows).toEqual([
      { movement_type: 'sale', quantity_delta: -3 },
      { movement_type: 'void_sale', quantity_delta: 3 },
    ])

    const again = await pgError(as(db, 'owner', (tx) => tx.query(`select public.void_sale($1, 'otra vez')`, [s.sale_id])))
    expect(again?.hint).toBe('already_voided')
    expect(await stockOf(p.id)).toBe(5)
    // La venta y sus líneas se conservan.
    expect((await db.query('select 1 from public.sale_items where sale_id = $1', [s.sale_id])).rows).toHaveLength(1)
  })

  it('el desconocido no puede anular', async () => {
    const p = await createProduct({ stock: 5 })
    const s = await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }] }))
    const err = await pgError(as(db, 'stranger', (tx) => tx.query(`select public.void_sale($1, 'x')`, [s.sale_id])))
    expect(err?.code).toBe('42501')
  })
})

describe('reportes y dashboard', () => {
  it('calculan con ventas completadas, excluyen anuladas y respetan Santo Domingo', async () => {
    const report = await createTestDb()
    await seedUsers(report)
    const prod = await as(report, 'owner', (tx) =>
      one<{ id: string }>(tx, `insert into public.products (name, slug, cost_price, sale_price, stock_quantity) values ('R', 'r', 60, 100, 100) returning id`),
    )
    const sell = async (qty: number, discount: number) =>
      as(report, 'owner', (tx) => createSale(tx, { items: [{ product_id: prod.id, quantity: qty }], discount, method: qty % 2 ? 'cash' : 'card', received: 100000 }))

    const s1 = await sell(2, 10) // neto 190, costo 120
    const s2 = await sell(1, 0) // neto 100, costo 60
    const s3 = await sell(4, 0) // anulada
    // 2026-03-10 23:30 en Santo Domingo = 2026-03-11 03:30 UTC → cuenta el día 10.
    await report.query(`update public.sales set created_at = '2026-03-11T03:30:00Z' where id = $1`, [s1.sale_id])
    // 2026-03-11 00:30 en Santo Domingo = 04:30 UTC → día 11 (fuera del período del día 10).
    await report.query(`update public.sales set created_at = '2026-03-11T04:30:00Z' where id = $1`, [s2.sale_id])
    await report.query(`update public.sales set created_at = '2026-03-10T15:00:00Z' where id = $1`, [s3.sale_id])
    await as(report, 'owner', (tx) => tx.query(`select public.void_sale($1, 'error')`, [s3.sale_id]))

    await as(report, 'owner', (tx) =>
      tx.query(`insert into public.expenses (expense_date, category, description, amount) values ('2026-03-10', 'transport', 'Envío', 50), ('2026-03-11', 'other', 'Fuera', 999)`),
    )
    await as(report, 'owner', (tx) =>
      tx.query(`insert into public.expenses (expense_date, category, description, amount) values ('2026-03-10', 'advertising', 'Anulado', 70)`),
    )
    await as(report, 'owner', (tx) => tx.query(`update public.expenses set is_voided = true where description = 'Anulado'`))

    const day10 = await as(report, 'owner', (tx) =>
      one<Record<string, string | number>>(tx, `select * from public.report_summary('2026-03-10', '2026-03-10')`),
    )
    expect(day10).toMatchObject({
      gross_sales: '200.00',
      discount_total: '10.00',
      net_sales: '190.00',
      cost_of_goods: '120.00',
      gross_profit: '70.00',
      expenses_total: '50.00',
      operating_result: '20.00',
      sales_count: 1,
      average_ticket: '190.00',
    })

    const both = await as(report, 'owner', (tx) => one<Record<string, string | number>>(tx, `select * from public.report_summary('2026-03-10', '2026-03-11')`))
    expect(both).toMatchObject({ net_sales: '290.00', sales_count: 2, average_ticket: '145.00', expenses_total: '1049.00' })

    const empty = await as(report, 'owner', (tx) => one<Record<string, string | number>>(tx, `select * from public.report_summary('2025-01-01', '2025-01-01')`))
    expect(empty).toMatchObject({ net_sales: '0.00', sales_count: 0, average_ticket: '0.00' })

    const days = await as(report, 'owner', (tx) => tx.query<{ day: Date | string; net_sales: string; sales_count: number }>(`select * from public.report_sales_by_day('2026-03-09', '2026-03-11')`))
    expect(days.rows.map((d) => [Number(d.net_sales), d.sales_count])).toEqual([
      [0, 0],
      [190, 1],
      [100, 1],
    ])

    const perf = await as(report, 'owner', (tx) => tx.query<{ units: number; net_amount: string; gross_profit: string }>(`select * from public.report_product_performance('2026-03-10', '2026-03-11')`))
    expect(perf.rows).toHaveLength(1)
    expect(perf.rows[0]).toMatchObject({ units: 3, net_amount: '290.00', gross_profit: '110.00' })

    const methods = await as(report, 'owner', (tx) => tx.query<{ payment_method: string; net_sales: string }>(`select * from public.report_payment_methods('2026-03-10', '2026-03-11')`))
    expect(Object.fromEntries(methods.rows.map((m) => [m.payment_method, m.net_sales]))).toEqual({ card: '190.00', cash: '100.00' })

    const exp = await as(report, 'owner', (tx) => tx.query<{ category: string; total: string }>(`select * from public.report_expenses_by_category('2026-03-10', '2026-03-10')`))
    expect(exp.rows).toEqual([{ category: 'transport', expense_count: 1, total: '50.00' }])

    const bad = await pgError(as(report, 'owner', (tx) => tx.query(`select * from public.report_summary('2026-03-11', '2026-03-10')`)))
    expect(bad?.message).toMatch(/Período inválido/)
    await report.close()
  })

  it('los gastos anulados no se pueden modificar ni borrar', async () => {
    await as(db, 'owner', (tx) => tx.query(`insert into public.expenses (expense_date, category, description, amount) values ('2026-01-05', 'other', 'Gasto X', 10)`))
    await as(db, 'owner', (tx) => tx.query(`update public.expenses set is_voided = true where description = 'Gasto X'`))
    const edit = await pgError(as(db, 'owner', (tx) => tx.query(`update public.expenses set amount = 5 where description = 'Gasto X'`)))
    expect(edit?.message).toMatch(/anulado/)
    const del = await pgError(as(db, 'owner', (tx) => tx.query(`delete from public.expenses where description = 'Gasto X'`)))
    expect(del?.code).toBe('42501')
  })
})

describe('Realtime saneado', () => {
  it('emite solo {kind, slug} y únicamente cuando cambia algo visible', async () => {
    const p = await createProduct({ stock: 10, threshold: 2 })
    await db.query('delete from realtime.sent')

    // Venta que no cambia el estado de disponibilidad: no emite.
    await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 1 }] }))
    expect((await db.query('select * from realtime.sent')).rows).toHaveLength(0)

    // Pasa a "pocas unidades": emite.
    await as(db, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 7 }] }))
    const sent = await db.query<{ payload: Record<string, unknown>; event: string; topic: string; private: boolean }>('select * from realtime.sent')
    expect(sent.rows).toHaveLength(1)
    expect(sent.rows[0]).toMatchObject({ event: 'catalog_changed', topic: 'catalog', private: false })
    expect(Object.keys(sent.rows[0]!.payload).sort()).toEqual(['kind', 'slug'])
    expect(sent.rows[0]!.payload).toEqual({ kind: 'product', slug: p.slug })

    // Cambio de costo (privado): no emite.
    await db.query('delete from realtime.sent')
    await as(db, 'owner', (tx) => tx.query(`update public.products set cost_price = 1 where id = $1`, [p.id]))
    expect((await db.query('select * from realtime.sent')).rows).toHaveLength(0)

    // Producto oculto que cambia: no emite.
    const hidden = await createProduct({ published: false })
    await db.query('delete from realtime.sent')
    await as(db, 'owner', (tx) => tx.query(`update public.products set sale_price = 1 where id = $1`, [hidden.id]))
    expect((await db.query('select * from realtime.sent')).rows).toHaveLength(0)

    // Despublicar emite (el cliente revalida y lo quita).
    await as(db, 'owner', (tx) => tx.query(`update public.products set is_published = false where id = $1`, [p.id]))
    expect((await db.query('select * from realtime.sent')).rows).toHaveLength(1)
  })

  it('un fallo de realtime.send no rompe la venta', async () => {
    const isolated = await createTestDb()
    await seedUsers(isolated)
    await isolated.exec(`create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$ begin raise exception 'realtime caído'; end $$;`)
    const p = await as(isolated, 'owner', (tx) =>
      one<{ id: string }>(tx, `insert into public.products (name, slug, cost_price, sale_price, stock_quantity, is_published) values ('X', 'x', 1, 2, 3, true) returning id`),
    )
    await as(isolated, 'owner', (tx) => createSale(tx, { items: [{ product_id: p.id, quantity: 3 }] }))
    const r = await one<{ s: number }>(isolated, 'select stock_quantity as s from public.products where id = $1', [p.id])
    expect(r.s).toBe(0)
    await isolated.close()
  })
})

describe('configuración y categorías', () => {
  it('el propietario actualiza la tienda con validación de WhatsApp', async () => {
    const bad = await pgError(as(db, 'owner', (tx) => tx.query(`update public.store_settings set whatsapp_number = '+1 809' where id`)))
    expect(bad?.code).toBe('23514')
    await as(db, 'owner', (tx) => tx.query(`update public.store_settings set whatsapp_number = '18090000000' where id`))
    const r = await as(db, 'anon', (tx) => one<{ whatsapp_number: string }>(tx, `select * from public.get_public_store_info()`))
    expect(r.whatsapp_number).toBe('18090000000')
    const tz = await pgError(as(db, 'owner', (tx) => tx.query(`update public.store_settings set timezone = 'UTC' where id`)))
    expect(tz?.code).toBe('42501')
  })

  it('una categoría con productos no se puede borrar y solo se publican categorías activas con productos', async () => {
    const cat = await as(db, 'owner', (tx) => one<{ id: string }>(tx, `insert into public.categories (name, slug) values ('Audio', 'audio') returning id`))
    await as(db, 'owner', (tx) => tx.query(`insert into public.categories (name, slug) values ('Vacía', 'vacia')`))
    await as(db, 'owner', (tx) =>
      tx.query(`insert into public.products (name, slug, cost_price, sale_price, category_id, is_published) values ('Bocina', 'bocina', 1, 2, $1, true)`, [cat.id]),
    )
    const err = await pgError(as(db, 'owner', (tx) => tx.query(`delete from public.categories where id = $1`, [cat.id])))
    expect(err?.code).toBe('23001') // restrict_violation (ON DELETE RESTRICT)

    const pub = await as(db, 'anon', (tx) => tx.query<{ slug: string }>(`select * from public.get_public_categories()`))
    expect(pub.rows.map((c) => c.slug)).toEqual(['audio'])

    await as(db, 'owner', (tx) => tx.query(`update public.categories set is_active = false where id = $1`, [cat.id]))
    const after = await as(db, 'anon', (tx) => tx.query(`select * from public.get_public_categories()`))
    expect(after.rows).toHaveLength(0)
    const prods = await as(db, 'anon', (tx) => tx.query(`select * from public.get_public_catalog_product_by_slug('bocina')`))
    expect(prods.rows).toHaveLength(0)
  })
})
