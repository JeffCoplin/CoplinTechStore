# Despliegue en Vercel

## 1. Importar el repositorio

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa `JeffCoplin/CoplinTechStore`.
2. Framework: **Vite** (detectado). `vercel.json` ya define build (`npm run build`), salida (`dist`), reescrituras SPA y cabeceras de seguridad.

## 2. Variables de entorno (Production y Preview)

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (`sb_publishable_…`) — o usa `VITE_SUPABASE_ANON_KEY` |

**Nunca** añadas `service_role`, claves `sb_secret_…` ni cadenas de conexión a variables `VITE_*`: todo lo que empieza por `VITE_` se incrusta en el JavaScript público.

## 3. Supabase para producción

- **Authentication → URL Configuration**: `Site URL` = dominio de Vercel (p. ej. `https://coplintech.vercel.app`). Añade también el dominio propio si lo usas.
- Registro público **desactivado** (ver `docs/SUPABASE_SETUP.md`).
- Migraciones aplicadas y propietario creado.

## 4. Verificación tras desplegar

```bash
npm run build && npm run check:bundle   # localmente, antes de publicar
```

- `/catalogo` carga sin sesión y no muestra costos ni cantidades.
- `/admin` redirige a `/admin/login` sin sesión.
- Con el propietario: crear producto, venta de prueba, anulación (y revisar el dashboard).
- Repasa `docs/SECURITY_CHECKLIST.md`.

## 5. Dominios y caché

Los assets en `/assets/*` se sirven con caché inmutable de 1 año (nombres con hash). `index.html` no se cachea de forma inmutable, por lo que los despliegues nuevos se ven de inmediato.
