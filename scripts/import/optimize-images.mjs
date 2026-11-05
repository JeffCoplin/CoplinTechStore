// Convierte las imágenes importadas a WebP optimizado con ffmpeg:
// lado mayor ≤ 1200 px, calidad 80. ffmpeg (≥ 7) aplica por sí mismo la
// orientación EXIF al decodificar, así que el WebP queda derecho aunque se
// eliminen los metadatos; el script comprueba que las dimensiones coincidan.
//   Entrada: backups/import/images/products/*.jpg|png|webp
//   Salida:  backups/import/optimized/products/<mismo-uuid>.webp
// Uso: node scripts/import/optimize-images.mjs   (requiere ffmpeg con libwebp)
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const SRC = 'backups/import/images/products'
const OUT = 'backups/import/optimized/products'
const MAX_SIDE = 1200
const QUALITY = 80

/** Orientación EXIF (1–8) de un JPEG; 1 si no tiene. */
function exifOrientation(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1
  let i = 2
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xff) return 1
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker === 0xe1 && buf.toString('ascii', i + 4, i + 8) === 'Exif') {
      const tiff = i + 10
      const le = buf.toString('ascii', tiff, tiff + 2) === 'II'
      const r16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o))
      const r32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o))
      const ifd = tiff + r32(tiff + 4)
      for (let k = 0; k < r16(ifd); k++) {
        const entry = ifd + 2 + k * 12
        if (r16(entry) === 0x0112) return r16(entry + 8)
      }
      return 1
    }
    if (marker === 0xda) return 1
    i += 2 + len
  }
  return 1
}

// ffprobe informa las dimensiones crudas del stream (sin aplicar EXIF).
function dimensions(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  )
  const [w, h] = out.trim().split(',').map(Number)
  return { w, h }
}

mkdirSync(OUT, { recursive: true })
let before = 0
let after = 0
for (const file of readdirSync(SRC).sort()) {
  const input = join(SRC, file)
  const output = join(OUT, `${basename(file, extname(file))}.webp`)
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', input,
    '-vf', `scale='min(${MAX_SIDE},iw)':'min(${MAX_SIDE},ih)':force_original_aspect_ratio=decrease`,
    '-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '6', '-map_metadata', '-1', output,
  ])
  // Con orientación 5–8 (90°/270°) la salida debe tener ancho y alto intercambiados respecto a los píxeles crudos.
  const raw = dimensions(input)
  const res = dimensions(output)
  const swapped = exifOrientation(readFileSync(input)) >= 5
  if (swapped !== (raw.w > raw.h) !== (res.w > res.h) && raw.w !== raw.h) {
    throw new Error(`Orientación inesperada en ${file}: crudo ${raw.w}x${raw.h} → ${res.w}x${res.h}`)
  }
  before += statSync(input).size
  after += statSync(output).size
}
const mb = (n) => (n / 1048576).toFixed(1)
console.warn(`Optimizadas: ${readdirSync(OUT).length} · ${mb(before)} MB → ${mb(after)} MB (${Math.round((1 - after / before) * 100)}% menos)`)
