# Configuración de Supabase

## 1. Crear el proyecto

1. Crea un proyecto en [supabase.com](https://supabase.com) (región cercana, p. ej. `us-east-1`).
2. Guarda la contraseña de la base de datos en un gestor de contraseñas (no en el repositorio).
3. En **Project Settings → API** copia la **Project URL** y la **clave publicable** (`sb_publishable_…`) o la clave `anon`. **No uses** la clave `service_role` / secreta en el frontend.

## 2. Variables locales

```bash
cp .env.example .env.local
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (o `VITE_SUPABASE_ANON_KEY`). `.env.local` está en `.gitignore`.

## 3. Aplicar las migraciones

Las migraciones están en `supabase/migrations/` (en orden):

| Archivo | Contenido |
|---|---|
| `…0100_schema.sql` | Tablas, restricciones, índices, inmutabilidad |
| `…0200_security.sql` | `is_owner()`, RLS, permisos por columna, stock inicial |
| `…0300_operations.sql` | `record_stock_movement`, `create_sale`, `void_sale` |
| `…0400_reports.sql` | Funciones de dashboard y reportes (zona Santo Domingo) |
| `…0500_catalog_storage_realtime.sql` | RPC públicas del catálogo, bucket `product-images`, Broadcast saneado |

Con Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

Alternativa sin CLI: abre **SQL Editor** y ejecuta cada archivo en orden.

Desarrollo local (requiere Docker): `npx supabase start` aplica las migraciones automáticamente; Studio en `http://127.0.0.1:54323`. `supabase/config.toml` ya tiene el registro público deshabilitado.

## 4. Crear el usuario propietario (manual)

1. **Authentication → Sign In / Providers**: desactiva **Allow new users to sign up** (no debe existir registro público).
2. **Authentication → Users → Add user → Create new user**: correo y contraseña robusta del propietario, marcando *Auto Confirm User*.
3. En **SQL Editor** (se ejecuta como administrador) vincula el perfil:

```sql
insert into public.owner_profiles (user_id, display_name)
select id, 'Propietario'
from auth.users
where email = '<correo-del-propietario>';
```

Solo puede existir **un** propietario activo (índice único). Para revocar el acceso: `update public.owner_profiles set is_active = false where user_id = '<uuid>';`.

## 5. Storage de imágenes

La migración `…0500` crea el bucket `product-images` (público para lectura por URL, 5 MB, JPG/PNG/WebP) y sus políticas:

- Lectura: pública por URL directa (rutas UUID no listables por `anon`).
- Subida/reemplazo/eliminación: solo el propietario activo, en rutas `products/<uuid>.<ext>`.

Verifica en **Storage → Policies** que existan `product_images_owner_*`.

## 6. Realtime

El catálogo escucha Broadcast público en el canal `catalog` (evento `catalog_changed`). Los triggers usan `realtime.send(...)` con payload `{kind, slug}` únicamente. No hace falta añadir `products` a la publicación `supabase_realtime` (y **no** debe añadirse: emitiría filas completas). Si Realtime no está disponible, el catálogo revalida periódicamente (45 s).

## 7. Datos de la tienda

Inicia sesión en `/admin/login` → **Configuración**: nombre (por defecto `CoplinTech`), número de WhatsApp (vacío hasta configurarlo) y umbral predeterminado de pocas unidades.

## 8. Tipos TypeScript

`src/types/database.types.ts` refleja el esquema. Para regenerarlo desde el proyecto:

```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```

## 9. Backups y restauración

- Los planes de pago de Supabase incluyen backups diarios (Database → Backups). En plan gratuito, haz respaldos manuales periódicos:

```bash
npx supabase db dump --linked -f backup_schema.sql
npx supabase db dump --linked --data-only -f backup_data_$(date +%F).sql
```

- Guarda los respaldos cifrados fuera del repositorio.
- Restauración: crea un proyecto nuevo, aplica `supabase/migrations/` y luego importa el dump de datos con `psql "<cadena-de-conexión>" -f backup_data_<fecha>.sql`. Verifica después el propietario y el bucket de imágenes (los archivos de Storage se respaldan aparte, p. ej. descargándolos con la CLI o la API).
- Prueba la restauración al menos una vez en un proyecto de staging.
