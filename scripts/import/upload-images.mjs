// Sube las imágenes decodificadas (backups/import/images/products/*) al bucket
// product-images del proyecto vinculado, una por una y con reintentos.
// Usa la sesión de `npx supabase login` (no requiere claves en archivos).
// Uso: node scripts/import/upload-images.mjs [carpeta]   (por defecto: imágenes originales)
//      node scripts/import/upload-images.mjs backups/import/optimized/products
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2] ?? 'backups/import/images/products'
const files = readdirSync(DIR).sort()

function cli(args) {
  return execFileSync('npx', ['supabase', 'storage', ...args, '--remote', '--experimental', '--yes'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

let ok = 0
const failed = []
for (const [i, file] of files.entries()) {
  let done = false
  for (let attempt = 1; attempt <= 6 && !done; attempt++) {
    try {
      cli(['cp', join(DIR, file), `ss:///product-images/products/${file}`, '--cache-control', 'max-age=31536000'])
      done = true
    } catch (e) {
      const msg = `${e.stdout ?? ''}${e.stderr ?? ''}`
      // Ya subida en un intento anterior cuya respuesta se perdió.
      if (/already exists|Duplicate|409/i.test(msg)) done = true
    }
  }
  if (done) ok++
  else failed.push(file)
  console.warn(`${i + 1}/${files.length} ${done ? 'OK' : 'FALLÓ'} ${file}`)
}
console.warn(`Subidas: ${ok}/${files.length}`)
if (failed.length) {
  console.warn('Fallaron (vuelve a ejecutar el script):\n' + failed.join('\n'))
  process.exit(1)
}
