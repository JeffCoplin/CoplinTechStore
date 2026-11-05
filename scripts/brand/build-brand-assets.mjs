// Genera los recursos de marca a partir del logo original (blanco sobre negro):
//   brand/logo-original.jpg  →  public/brand/*
// - logo-mark.png / logo-wordmark.png / logo-tagline.png / logo-full.png: blanco con fondo transparente
// - favicon-32.png, icon-192.png, icon-512.png, apple-touch-icon.png: ícono sobre fondo oscuro
// - og-image.png (1200×630): vista previa al compartir enlaces (WhatsApp, redes)
// Uso: node scripts/brand/build-brand-assets.mjs   (requiere ffmpeg)
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SRC = 'brand/logo-original.jpg'
const OUT = 'public/brand'
const BG = '0x14181f' // mismo fondo oscuro de la app

// Regiones del logo de 1080×1080 (detectadas por umbral de luminancia, con margen).
const REGIONS = {
  mark: { x: 324, y: 285, w: 464, h: 376 },
  wordmark: { x: 110, y: 685, w: 878, h: 82 },
  tagline: { x: 202, y: 789, w: 692, h: 36 },
  full: { x: 110, y: 285, w: 878, h: 540 },
}

// Blanco puro con alfa = luminancia (limpia el ruido JPEG del fondo negro).
function whiteOnTransparent({ x, y, w, h }, scale = '') {
  const crop = `crop=${w}:${h}:${x}:${y}${scale ? `,${scale}` : ''}`
  return `[0:v]${crop},split[c1][c2];[c1]lutrgb=r=255:g=255:b=255,format=rgba[w];[c2]format=gray,lut=y='clip((val-24)*255/196,0,255)'[a];[w][a]alphamerge`
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })
}

mkdirSync(OUT, { recursive: true })

for (const [name, region] of Object.entries(REGIONS)) {
  ffmpeg(['-i', SRC, '-filter_complex', whiteOnTransparent(region), '-frames:v', '1', `${OUT}/logo-${name}.png`])
}

// Íconos cuadrados: el ícono ocupa ~72 % del lado, centrado, sobre fondo oscuro.
for (const [file, size] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const inner = Math.round(size * 0.72)
  ffmpeg([
    '-f', 'lavfi', '-i', `color=c=${BG}:s=${size}x${size}`,
    '-i', `${OUT}/logo-mark.png`,
    '-filter_complex', `[1:v]scale=${inner}:-1:flags=lanczos[m];[0:v][m]overlay=(W-w)/2:(H-h)/2:format=auto`,
    '-frames:v', '1', `${OUT}/${file}`,
  ])
}

// Imagen para compartir: logo completo centrado sobre un degradado sutil.
ffmpeg([
  '-f', 'lavfi', '-i', `gradients=s=1200x630:c0=0x1d2430:c1=${BG}:type=radial:x0=600:y0=260:x1=600:y1=900`,
  '-i', `${OUT}/logo-full.png`,
  '-filter_complex', '[1:v]scale=-1:420:flags=lanczos[l];[0:v][l]overlay=(W-w)/2:(H-h)/2:format=auto',
  '-frames:v', '1', `${OUT}/og-image.png`,
])

console.warn(`Recursos de marca generados en ${OUT}/`)
