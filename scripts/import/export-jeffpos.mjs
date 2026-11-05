// Exporta (solo lectura) el catálogo del tenant "coplintech" desde el proyecto
// Supabase anterior (JEFFPOS) a backups/jeffpos_coplintech_catalog.json.
// Uso: node scripts/import/export-jeffpos.mjs <project-ref-origen>
// Requiere `npx supabase login`. Usa `db query --read-only`: no modifica nada.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ref = process.argv[2]
if (!ref) {
  console.error('Uso: node scripts/import/export-jeffpos.mjs <project-ref-origen>')
  process.exit(1)
}

const sqlFile = join(mkdtempSync(join(tmpdir(), 'coplintech-export-')), 'q.sql')

function query(sql) {
  writeFileSync(sqlFile, sql)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const out = execFileSync('npx', ['supabase', 'db', 'query', `--remote=${ref}`, '--read-only', '--output-format', 'json', '--file', sqlFile], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const json = JSON.parse(out.slice(out.indexOf('{')))
      if (Array.isArray(json.rows)) return json.rows
      throw new Error(JSON.stringify(json).slice(0, 300))
    } catch (e) {
      if (attempt === 5) throw e
      console.warn(`Reintentando (${attempt})…`)
    }
  }
}

const TENANT = `(select id from public.tenants where slug = 'coplintech')`

const categories = query(
  `select id, name, parent_id, created_at from public.categories where tenant_id = ${TENANT} order by name`,
)
const products = query(
  `select p.id, p.name, p.description, p.category_id, p.purchase_price, p.sale_price, p.is_active, p.display_order, p.created_at, ` +
    `coalesce((select sum(i.quantity) from public.inventory i where i.product_id = p.id), 0)::int as stock, ` +
    `coalesce((select max(i.min_stock) from public.inventory i where i.product_id = p.id), 0)::int as min_stock ` +
    `from public.products p where p.tenant_id = ${TENANT} order by p.display_order nulls last, p.created_at`,
)

const images = {}
for (let i = 0; i < products.length; i += 4) {
  const ids = products.slice(i, i + 4).map((p) => `'${p.id}'`).join(',')
  for (const row of query(`select id, image_url from public.products where id in (${ids})`)) images[row.id] = row.image_url
  console.warn(`Imágenes ${Math.min(i + 4, products.length)}/${products.length}`)
}

mkdirSync('backups', { recursive: true })
const file = 'backups/jeffpos_coplintech_catalog.json'
writeFileSync(file, JSON.stringify({ exported_at: new Date().toISOString(), source_ref: ref, categories, products: products.map((p) => ({ ...p, image_url: images[p.id] ?? null })) }, null, 1))
console.warn(`OK: ${categories.length} categorías y ${products.length} productos en ${file}`)
