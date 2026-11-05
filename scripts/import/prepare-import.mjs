// Prepara la importación del catálogo exportado de JEFFPOS al esquema de CoplinTech.
//   Entrada: backups/jeffpos_coplintech_catalog.json (export-jeffpos.mjs)
//   Salida:  backups/import/images/products/<uuid>.<ext>  (imágenes decodificadas del base64)
//            backups/import/import.sql                      (una sola transacción)
// Uso: node scripts/import/prepare-import.mjs
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'backups/jeffpos_coplintech_catalog.json'
const OUT = 'backups/import'
const IMG_DIR = join(OUT, 'images', 'products')
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

function slugify(input) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

function uniqueSlug(base, used) {
  let slug = base || 'producto'
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
  used.add(slug)
  return slug
}

const data = JSON.parse(readFileSync(SOURCE, 'utf8'))
if (existsSync(OUT)) rmSync(OUT, { recursive: true })
mkdirSync(IMG_DIR, { recursive: true })

const usedCategorySlugs = new Set()
const categoryMap = new Map()
const categories = data.categories
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  .map((c, i) => {
    const row = { id: randomUUID(), name: c.name.trim(), slug: uniqueSlug(slugify(c.name), usedCategorySlugs), sort_order: (i + 1) * 10 }
    categoryMap.set(c.id, row.id)
    return row
  })

const usedSlugs = new Set()
const problems = []
const products = data.products.map((p) => {
  const name = p.name.trim().replace(/\s+/g, ' ')
  let imagePath = null
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(p.image_url ?? '')
  if (m) {
    const ext = MIME_EXT[m[1]]
    const bytes = Buffer.from(m[2], 'base64')
    if (!ext) problems.push(`${name}: formato de imagen no permitido (${m[1]})`)
    else if (bytes.length > MAX_IMAGE_BYTES) problems.push(`${name}: imagen de ${(bytes.length / 1048576).toFixed(1)} MB supera 5 MB`)
    else {
      const file = `${randomUUID()}.${ext}`
      writeFileSync(join(IMG_DIR, file), bytes)
      imagePath = `products/${file}`
    }
  } else if (p.image_url) problems.push(`${name}: la imagen no es un data URI (se omite)`)

  if (Number(p.sale_price) <= 0) problems.push(`${name}: precio de venta inválido`)
  return {
    name,
    slug: uniqueSlug(slugify(name), usedSlugs),
    description: p.description?.trim() || null,
    category_id: p.category_id ? (categoryMap.get(p.category_id) ?? null) : null,
    cost_price: Number(p.purchase_price),
    sale_price: Number(p.sale_price),
    stock_quantity: Math.max(0, Number(p.stock) || 0),
    low_stock_threshold: Math.max(0, Number(p.min_stock) || 0),
    image_path: imagePath,
    is_active: Boolean(p.is_active),
    is_published: Boolean(p.is_active),
  }
})

const payload = JSON.stringify({ categories, products }).replace(/'/g, "''")

const sql = `-- Importación del catálogo de CoplinTech desde JEFFPOS (${data.exported_at}).
-- Una sola transacción: o se importa todo o nada. Se niega si ya hay productos.
begin;

do $import$
declare
  v_owner uuid;
  v_data  jsonb := '${payload}'::jsonb;
begin
  select user_id into v_owner from public.owner_profiles where is_active;
  if v_owner is null then
    raise exception 'Primero crea el propietario (owner_profiles)';
  end if;
  if exists (select 1 from public.products) or exists (select 1 from public.categories) then
    raise exception 'La base ya tiene productos o categorías: importación cancelada para no duplicar';
  end if;

  -- El trigger de existencia inicial registra el movimiento a nombre del propietario.
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  insert into public.categories (id, name, slug, sort_order, is_active)
  select id, name, slug, sort_order, true
  from jsonb_to_recordset(v_data -> 'categories') as c(id uuid, name text, slug text, sort_order int);

  insert into public.products
    (name, slug, description, category_id, cost_price, sale_price, stock_quantity,
     low_stock_threshold, image_path, is_active, is_published)
  select name, slug, description, category_id, cost_price, sale_price, stock_quantity,
         low_stock_threshold, image_path, is_active, is_published
  from jsonb_to_recordset(v_data -> 'products') as p(
    name text, slug text, description text, category_id uuid, cost_price numeric, sale_price numeric,
    stock_quantity int, low_stock_threshold int, image_path text, is_active boolean, is_published boolean);
end
$import$;

select
  (select count(*) from public.categories) as categorias,
  (select count(*) from public.products) as productos,
  (select coalesce(sum(stock_quantity), 0) from public.products) as unidades,
  (select count(*) from public.stock_movements where movement_type = 'initial_stock') as movimientos_iniciales;

commit;
`
writeFileSync(join(OUT, 'import.sql'), sql)

console.warn(`Categorías: ${categories.length} · Productos: ${products.length} · Imágenes: ${products.filter((p) => p.image_path).length}`)
console.warn(`Unidades: ${products.reduce((a, p) => a + p.stock_quantity, 0)} · Publicados: ${products.filter((p) => p.is_published).length}`)
const renamed = products.filter((p, i, all) => all.findIndex((q) => q.name === p.name) !== i)
if (renamed.length) console.warn(`Nombres repetidos (slug con sufijo): ${renamed.map((p) => p.slug).join(', ')}`)
if (problems.length) console.warn('Avisos:\n - ' + problems.join('\n - '))
