# Despliegue en Vercel

**Producción actual:** https://coplintech.vercel.app (proyecto Vercel `coplintech`, Supabase `lcnfdcoteztogbnzzdie`).

Redesplegar manualmente desde la carpeta del proyecto:

```bash
npx vercel deploy --prod
```

Para que cada `git push` a `main` despliegue solo: Vercel → proyecto `coplintech` → **Settings → Git → Connect Git Repository** → `JeffCoplin/CoplinTechStore`.

## Mantener Supabase activo (plan gratuito)

Supabase pausa los proyectos gratuitos tras 7 días sin actividad. El workflow `.github/workflows/keep-supabase-awake.yml` consulta una RPC pública cada día. Necesita dos secrets del repositorio (desde PowerShell, en la carpeta del proyecto):

```powershell
gh secret set SUPABASE_URL --repo JeffCoplin/CoplinTechStore --body ((Select-String -Path .env.local -Pattern '^VITE_SUPABASE_URL=(.*)$').Matches[0].Groups[1].Value.Trim())
gh secret set SUPABASE_PUBLISHABLE_KEY --repo JeffCoplin/CoplinTechStore --body ((Select-String -Path .env.local -Pattern '^VITE_SUPABASE_PUBLISHABLE_KEY=(.*)$').Matches[0].Groups[1].Value.Trim())
```

Pruébalo en GitHub → **Actions → Mantener Supabase activo → Run workflow**.

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
