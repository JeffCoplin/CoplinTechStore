# Pruebas

## Comandos

```bash
npm run typecheck    # TypeScript estricto
npm run lint         # oxlint
npm test             # unitarias (src/**/*.test.ts)
npm run test:db      # base de datos (tests/db)
npm run build        # build de producción
npm run check:bundle # sin secretos en dist/ (después del build)
```

## Unitarias (`src/**/*.test.ts`)

- Moneda DOP: formato `Intl.NumberFormat('es-DO', { currency: 'DOP' })`, aritmética en centavos, redondeo igual a `numeric(12,2)`.
- Fechas `America/Santo_Domingo`: día local vs. UTC, períodos (hoy, 7 días, este mes, mes anterior, cruce de año), período anterior equivalente.
- Carrito/POS: subtotal, descuento, total, cambio; validación de descuentos, importe recibido, cantidades y existencias; el payload de venta no incluye precios.
- Inventario: reglas de entradas/ajustes.
- Utilidades: slugs, CSV (escape e inyección de fórmulas), enlace de WhatsApp.

## Base de datos (`tests/db/database.test.ts`)

Se ejecutan con **PGlite** (PostgreSQL real compilado a WASM, sin Docker). `tests/db/harness.ts` crea un stub mínimo de Supabase (roles `anon`/`authenticated`, `auth.uid()`, `storage`, `realtime.send`) con los mismos privilegios por defecto amplios de Supabase y luego aplica **las migraciones reales**.

Cobertura:

- Seguridad anon / autenticado sin perfil / propietario (ver `SECURITY_CHECKLIST.md`).
- Stock inicial → movimiento `initial_stock`; la edición no cambia stock; entradas y ajustes; inmutabilidad de movimientos.
- `create_sale`: venta exitosa con snapshots; cada método de pago; stock insuficiente; **doble envío** (misma clave → una venta); **fallo a mitad de transacción** (producto inactivo en la segunda línea → nada persiste); validaciones; precios impuestos por el navegador ignorados; snapshots inmutables tras cambiar precio/costo.
- `void_sale`: restaura stock, movimientos compensatorios, **anulación repetida rechazada**, venta conservada.
- Reportes: excluyen anuladas y gastos anulados; límites de día en Santo Domingo (23:30 local vs. 00:30 local); prorrateo de descuento por producto; ticket promedio con 0 ventas.
- Realtime: payload `{kind, slug}` únicamente; no emite por cambios de costo, de productos ocultos ni de stock sin cambio de estado; un fallo de Realtime no revierte la venta.
- Configuración (validación de WhatsApp, campos fijos), categorías (FK, visibilidad pública).

### Concurrencia real (`tests/db/concurrency.test.ts`)

PGlite admite una sola conexión, así que la prueba de **dos ventas simultáneas por la última unidad** y de reintentos simultáneos con la misma clave se ejecuta contra Supabase local:

```bash
npx supabase start
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

Sin `DATABASE_URL` esa suite se omite (aparece como *skipped*). Requiere una base local sin propietario activo y crea/borra sus propios datos. **Nunca** apuntar a producción.

## Estado de la última ejecución

Ver el resumen del commit/PR correspondiente. A la fecha de la primera versión:

- Unitarias: pasan.
- Base de datos (PGlite): pasan.
- Concurrencia real: **pendiente** (no había Docker disponible para `supabase start`).
- Pruebas end-to-end con un proyecto Supabase real: **pendientes** (requieren credenciales del proyecto).

## Prueba manual sugerida (con Supabase configurado)

1. Iniciar sesión como propietario; intentar con un usuario sin perfil (debe ser rechazado).
2. Crear categoría y producto con imagen y existencia inicial → ver movimiento en Inventario.
3. Abrir `/catalogo` en otra ventana; publicar/ocultar el producto y vender hasta "Pocas unidades" → el catálogo se actualiza solo.
4. Venta en efectivo con cambio, otra con tarjeta y otra con transferencia; imprimir recibo.
5. Anular una venta (motivo obligatorio) → stock restaurado y dashboard sin esa venta.
6. Registrar un gasto y verificar el resultado operativo del período.
7. Exportar CSV de ventas y reportes con filtros.
