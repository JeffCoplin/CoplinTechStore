# Importación del catálogo desde JEFFPOS

El catálogo de CoplinTech se importó desde el proyecto Supabase anterior **JEFFPOS** (`yxlvcmioduceserfrfbz`, tenant `coplintech`) al proyecto nuevo **CoplinTech** (`lcnfdcoteztogbnzzdie`). JEFFPOS **no se modificó**: todas las lecturas usaron `supabase db query --read-only`.

## Qué se importó

| Origen (JEFFPOS) | Destino (CoplinTech) |
|---|---|
| `categories` del tenant (7) | `categories` (slug generado, orden alfabético) |
| `products` del tenant (38) | `products`, todos activos y **publicados** |
| `purchase_price` | `cost_price` |
| `sale_price` | `sale_price` |
| suma de `inventory.quantity` | `stock_quantity` (registrado como movimiento `initial_stock`) |
| `inventory.min_stock` | `low_stock_threshold` |
| `image_url` (base64 dentro de la BD) | archivo en Storage `product-images/products/<uuid>.jpg` |

No se importó: órdenes/pagos (90), clientes, otros tenants (JCoplinTech, Tienda Demo, etc.), planes ni suscripciones.

Los nombres repetidos (variantes de color) recibieron slugs con sufijo (`-2`, `-3`…). Conviene renombrarlos desde **Productos** para distinguirlos (p. ej. añadir el color).

## Scripts (re-ejecutables)

```bash
node scripts/import/export-jeffpos.mjs yxlvcmioduceserfrfbz   # solo lectura → backups/jeffpos_coplintech_catalog.json
node scripts/import/prepare-import.mjs                         # → backups/import/import.sql + imágenes
node scripts/import/upload-images.mjs                          # sube imágenes al proyecto vinculado
npx supabase db query --remote --file backups/import/import.sql
```

`import.sql` corre en una sola transacción, exige un propietario activo y se niega a ejecutarse si ya hay productos o categorías (no duplica). `backups/` está en `.gitignore` porque contiene datos reales.
