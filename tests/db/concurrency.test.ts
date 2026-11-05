import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Concurrencia real con dos conexiones simultáneas. Requiere un PostgreSQL de
 * Supabase con las migraciones aplicadas (p. ej. `npx supabase start`):
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
 *
 * Sin DATABASE_URL la prueba se omite (PGlite solo admite una conexión).
 * Crea un usuario y propietario de prueba temporales y los elimina al final.
 * NUNCA ejecutar contra producción.
 */
const url = process.env.DATABASE_URL
const TEST_OWNER = '33333333-3333-4333-8333-333333333333'

describe.skipIf(!url)('concurrencia (Supabase local)', () => {
  let admin: pg.Client
  let productId: string
  let hadOwner = false

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: url })
    await admin.connect()
    hadOwner = (await admin.query('select 1 from public.owner_profiles where is_active')).rowCount! > 0
    if (hadOwner) throw new Error('Ya existe un propietario activo: usa una base local vacía para esta prueba.')
    await admin.query(`insert into auth.users (id, email, aud, role) values ($1, 'concurrency@test.local', 'authenticated', 'authenticated') on conflict do nothing`, [TEST_OWNER])
    await admin.query(`insert into public.owner_profiles (user_id) values ($1) on conflict do nothing`, [TEST_OWNER])
  })

  afterAll(async () => {
    if (!admin) return
    // Limpieza como superusuario (los triggers de inmutabilidad se omiten solo en esta sesión de prueba).
    await admin.query(`set session_replication_role = replica`)
    if (productId) {
      await admin.query(`delete from public.stock_movements where product_id = $1`, [productId])
      await admin.query(`delete from public.sale_items where product_id = $1`, [productId])
      await admin.query(`delete from public.sales where created_by = $1`, [TEST_OWNER])
      await admin.query(`delete from public.products where id = $1`, [productId])
    }
    await admin.query(`delete from public.owner_profiles where user_id = $1`, [TEST_OWNER])
    await admin.query(`delete from auth.users where id = $1`, [TEST_OWNER])
    await admin.query(`set session_replication_role = origin`)
    await admin.end()
  })

  async function ownerClient(): Promise<pg.Client> {
    const c = new pg.Client({ connectionString: url })
    await c.connect()
    return c
  }

  async function asOwner<T>(c: pg.Client, fn: () => Promise<T>): Promise<T> {
    await c.query('begin')
    await c.query(`set local role authenticated`)
    await c.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [
      TEST_OWNER,
      JSON.stringify({ sub: TEST_OWNER, role: 'authenticated' }),
    ])
    try {
      const r = await fn()
      await c.query('commit')
      return r
    } catch (e) {
      await c.query('rollback')
      throw e
    }
  }

  it('dos ventas simultáneas no pueden vender la última unidad dos veces', async () => {
    const a = await ownerClient()
    const b = await ownerClient()
    try {
      const created = await asOwner(a, () =>
        a.query<{ id: string }>(
          `insert into public.products (name, slug, cost_price, sale_price, stock_quantity) values ('Última unidad', 'ultima-unidad-test', 1, 10, 1) returning id`,
        ),
      )
      productId = created.rows[0]!.id
      const items = JSON.stringify([{ product_id: productId, quantity: 1 }])
      const attempt = (c: pg.Client) =>
        asOwner(c, () => c.query(`select * from public.create_sale(gen_random_uuid(), $1::jsonb, 'card', 0, null, null)`, [items]))

      const results = await Promise.allSettled([attempt(a), attempt(b)])
      const ok = results.filter((r) => r.status === 'fulfilled')
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      expect(ok).toHaveLength(1)
      expect(failed).toHaveLength(1)
      expect(String((failed[0]!.reason as Error).message)).toMatch(/Existencia insuficiente/)

      const stock = await admin.query<{ s: number }>('select stock_quantity as s from public.products where id = $1', [productId])
      expect(stock.rows[0]!.s).toBe(0)
    } finally {
      await a.end()
      await b.end()
    }
  })

  it('reintentos simultáneos con la misma clave producen una sola venta', async () => {
    const a = await ownerClient()
    const b = await ownerClient()
    try {
      await asOwner(a, () => a.query(`select public.record_stock_movement($1, 'restock', 5, 'Prueba')`, [productId]))
      const requestId = crypto.randomUUID()
      const items = JSON.stringify([{ product_id: productId, quantity: 2 }])
      const attempt = (c: pg.Client) =>
        asOwner(c, () => c.query<{ sale_id: string }>(`select * from public.create_sale($1, $2::jsonb, 'card', 0, null, null)`, [requestId, items]))
      const [r1, r2] = await Promise.all([attempt(a), attempt(b)])
      expect(r1.rows[0]!.sale_id).toBe(r2.rows[0]!.sale_id)
      const stock = await admin.query<{ s: number }>('select stock_quantity as s from public.products where id = $1', [productId])
      expect(stock.rows[0]!.s).toBe(3)
    } finally {
      await a.end()
      await b.end()
    }
  })
})
