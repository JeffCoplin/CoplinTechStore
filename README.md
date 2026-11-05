# CoplinTech — Punto de venta, inventario y catálogo

Sistema privado de **CoplinTech** para administrar productos, existencias, ventas físicas, gastos y reportes, con un **catálogo público de solo lectura** conectado a los mismos datos.

- Una sola tienda y una sola cuenta propietaria (sin registro público).
- Ventas físicas: efectivo, transferencia y tarjeta. Sin carrito público, pedidos ni pagos online.
- Catálogo público con estados `Disponible`, `Pocas unidades`, `Agotado` (nunca cantidades exactas ni costos).
- Moneda DOP (RD$), español, zona horaria `America/Santo_Domingo`.

La especificación completa está en [`PRD.md`](PRD.md) (fuente de verdad del producto).

## Stack

React 19 + Vite + TypeScript (estricto) · React Router · Tailwind CSS 4 + shadcn/ui (Radix) · TanStack Query · React Hook Form + Zod · Recharts · Lucide · Supabase (PostgreSQL, Auth, Storage, Realtime) · Vercel.

## Requisitos

- Node.js 20+ (probado con Node 24) y npm.
- Un proyecto de Supabase (o Supabase CLI + Docker para desarrollo local).

## Instalación y desarrollo local

```bash
npm install
cp .env.example .env.local   # y completa VITE_SUPABASE_URL y la clave publicable
npm run dev                  # http://localhost:5173
```

Configura la base de datos siguiendo [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) (migraciones, usuario propietario, Storage).

Rutas principales:

| Ruta | Acceso |
|---|---|
| `/catalogo`, `/catalogo/:slug` | Público |
| `/admin/login` | Público (solo inicio de sesión) |
| `/admin/*` | Solo propietario activo |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | Verificación de tipos (TypeScript) |
| `npm run lint` | Lint (oxlint) |
| `npm test` | Pruebas unitarias (moneda, fechas, carrito, inventario, utilidades) |
| `npm run test:db` | Pruebas de base de datos: aplica las migraciones reales en PostgreSQL embebido (PGlite) y prueba RLS, ventas, anulaciones, reportes y Realtime |
| `npm run build` | Build de producción en `dist/` |
| `npm run check:bundle` | Revisa que `dist/` no contenga secretos privados |

Detalle en [`docs/TESTING.md`](docs/TESTING.md). El catálogo inicial se importó del proyecto anterior: ver [`docs/IMPORT_JEFFPOS.md`](docs/IMPORT_JEFFPOS.md).

## Estructura

```text
src/
  app/            router, providers, guard RequireOwner, layouts
  components/     ui/ (shadcn), shared/ (estados, filtros, diálogos), navigation/
  features/       auth, dashboard, products, categories, pos, sales,
                  inventory, expenses, reports, catalog, settings
  lib/            supabase/ (cliente, errores), currency/, dates/, domain/, utils/
  types/          database.types.ts
supabase/
  migrations/     esquema, seguridad (RLS), operaciones, reportes, catálogo/Storage/Realtime
  seed.sql        vacío a propósito (sin datos ficticios)
tests/db/         pruebas de base de datos
docs/             configuración, despliegue, seguridad y pruebas
```

## Principios de integridad

- Ventas (`create_sale`) y anulaciones (`void_sale`) son funciones transaccionales de PostgreSQL: validan propietario, bloquean filas de productos, calculan precios/totales en la base de datos, guardan snapshots y movimientos en la misma transacción, y son idempotentes.
- El stock solo cambia por movimientos explícitos (`record_stock_movement`), nunca editando el producto.
- Ventas, líneas y movimientos son inmutables; las anulaciones se compensan, no se borran.
- El catálogo público lee solo RPC que proyectan campos permitidos; Realtime emite `{kind, slug}` y el cliente vuelve a consultar.

## Despliegue

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Seguridad: [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md).

> El recibo es un documento interno de CoplinTech: no es factura ni comprobante fiscal (NCF). El resultado operativo es una estimación interna, no un estado financiero.
