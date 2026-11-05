// Revisa el build de producción (dist/) en busca de secretos que nunca deben
// llegar al navegador. Ejecutar después de `npm run build`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const PATTERNS = [
  { name: 'service_role', re: /service_role/i },
  { name: 'clave secreta de Supabase (sb_secret_)', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', re: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: 'cadena de conexión PostgreSQL', re: /postgres(ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/i },
  { name: 'clave privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

let files
try {
  files = walk(DIST)
} catch {
  console.error('No existe dist/. Ejecuta primero: npm run build')
  process.exit(1)
}

const findings = []
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  for (const { name, re } of PATTERNS) if (re.test(content)) findings.push(`${file}: ${name}`)
  // Un JWT con role service_role en el payload.
  for (const jwt of content.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'))
      if (payload.role && payload.role !== 'anon') findings.push(`${file}: JWT con role=${payload.role}`)
    } catch {
      /* no es un JWT válido */
    }
  }
}

if (findings.length) {
  console.error('Posibles secretos en el bundle:\n' + findings.map((f) => ' - ' + f).join('\n'))
  process.exit(1)
}
console.warn(`OK: ${files.length} archivos revisados en dist/, sin secretos privados.`)
