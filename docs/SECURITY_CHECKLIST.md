# Checklist de seguridad

La autorización vive en PostgreSQL (RLS, privilegios y funciones). La UI solo refleja esas reglas.

## Identidad

- [x] Sin registro público (`enable_signup = false` local; desactivar en el dashboard de producción).
- [x] Propietario = fila activa en `owner_profiles` vinculada a `auth.uid()`; máximo **uno** activo (índice único parcial).
- [x] `owner_profiles` no tiene permisos de escritura para `anon`/`authenticated` (alta solo por SQL administrativo).
- [x] El guard `RequireOwner` cierra la sesión de usuarios autenticados sin perfil activo.
- [x] El cliente solo usa URL + clave publicable/anon. `npm run check:bundle` busca `service_role`, `sb_secret_`, JWT con rol distinto de `anon`, cadenas de conexión y claves privadas.

## Permisos por tabla

Todas las tablas tienen RLS habilitado y se revocan los privilegios por defecto de Supabase (`revoke all … from public, anon, authenticated`).

| Tabla | anon | authenticated (no propietario) | Propietario |
|---|---|---|---|
| `owner_profiles` | — | solo su propia fila (lectura) | su fila (lectura) |
| `store_settings` | — | 0 filas | leer; editar `store_name`, `whatsapp_number`, `default_low_stock_threshold` |
| `categories` | — | 0 filas | CRUD (borrado bloqueado por FK si tiene productos) |
| `products` | — | 0 filas | leer, insertar, editar **sin** `stock_quantity` (privilegio por columna); sin `DELETE` |
| `sales`, `sale_items`, `stock_movements` | — | 0 filas | solo lectura; escritura exclusiva vía RPC |
| `expenses` | — | 0 filas | leer, insertar, editar/anular (`is_voided`); sin `DELETE`; un gasto anulado es inmutable |

Además, triggers impiden `UPDATE/DELETE` de `stock_movements` y `sale_items`, y `DELETE` de `sales` y `expenses`, incluso para el superusuario.

## Funciones

| Función | Tipo | EXECUTE | Notas |
|---|---|---|---|
| `is_owner`, `assert_owner` | SECURITY DEFINER | authenticated | `search_path = ''` |
| `record_stock_movement` | SECURITY DEFINER | authenticated | `assert_owner()`, `FOR UPDATE`, sin stock negativo, motivo obligatorio en ajustes |
| `create_sale` | SECURITY DEFINER | authenticated | `assert_owner()`, idempotencia (`client_request_id` + advisory lock), bloqueo ordenado de filas, precios/costos/totales calculados en BD, snapshots, todo en una transacción |
| `void_sale` | SECURITY DEFINER | authenticated | `assert_owner()`, `FOR UPDATE` de la venta, rechaza doble anulación, movimientos compensatorios |
| `report_*`, `inventory_status_counts`, `products_needing_restock` | SECURITY INVOKER | authenticated | `assert_owner()` + RLS |
| `get_public_catalog_products`, `get_public_catalog_product_by_slug`, `get_public_categories`, `get_public_store_info` | SECURITY DEFINER | anon, authenticated | Proyección explícita: nombre, slug, marca, categoría, descripción, precio, imagen, disponibilidad. Nunca `cost_price`, `stock_quantity`, `low_stock_threshold` ni IDs internos |
| triggers (`products_initial_stock`, `products_broadcast_change`, …) | SECURITY DEFINER | nadie | `search_path = ''` |

Todas las funciones fijan `search_path = ''` y califican objetos con su esquema.

## Catálogo y Realtime

- [x] El catálogo nunca consulta tablas: solo las RPC públicas.
- [x] Solo productos `is_active AND is_published` (y categoría activa o sin categoría).
- [x] Búsqueda con comodines escapados y longitud limitada; paginación acotada (máx. 100).
- [x] Broadcast público `catalog` con payload `{kind, slug}`; solo se emite si cambia un dato visible o el **estado** de disponibilidad (no cada cambio de stock ni de costo).
- [x] Un fallo de Realtime no revierte ventas (excepción capturada) y el cliente tiene revalidación periódica.
- [x] `products` **no** está en la publicación `supabase_realtime` (no se transmiten `NEW/OLD`).

## Storage

- [x] Bucket `product-images`: 5 MB, `image/jpeg|png|webp` validados por el bucket y en el cliente.
- [x] Escritura/reemplazo/borrado solo propietario, rutas `products/<uuid>.<ext>`.
- [x] Lectura pública por URL directa (bucket público). Decisión: las imágenes de productos no publicados también son accesibles **si se conoce la ruta UUID**, pero `anon` no puede listar el bucket. Si se necesitara ocultarlas estrictamente, cambiar a bucket privado con URLs firmadas generadas por una RPC.

## Pruebas de acceso ejecutadas (`npm run test:db`)

- `anon`: `42501` al leer las 8 tablas; no puede actualizar productos ni ejecutar `create_sale`, `void_sale` ni `report_summary`; el catálogo devuelve exactamente las 10 columnas permitidas.
- Autenticado sin perfil: 0 filas en `products`/`store_settings`; `42501` al insertar productos, vender, mover stock, ver reportes, anular o autoasignarse como propietario.
- Propietario: no puede cambiar `stock_quantity` directamente, borrar productos, editar/borrar ventas ni modificar movimientos.

## Pendiente de verificar contra el proyecto remoto

- [ ] Registro público desactivado en el dashboard de producción.
- [ ] Prueba de concurrencia real (`tests/db/concurrency.test.ts` con `DATABASE_URL` de Supabase local).
- [ ] Llamar a las RPC con la clave anon real (por ejemplo con `curl`) y confirmar las mismas respuestas.
- [ ] Revisar **Advisors → Security** en el dashboard de Supabase tras aplicar las migraciones.
