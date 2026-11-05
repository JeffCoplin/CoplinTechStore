/** Lado mayor máximo de las imágenes de producto (suficiente para el detalle del catálogo). */
export const MAX_IMAGE_SIDE = 1200
const WEBP_QUALITY = 0.8
const JPEG_QUALITY = 0.82

/** Dimensiones escaladas para que el lado mayor no supere `max`, sin agrandar. */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Redimensiona y recomprime una imagen en el navegador antes de subirla
 * (WebP; JPEG si el navegador no codifica WebP). Respeta la orientación EXIF.
 * Si el resultado no es más pequeño, devuelve el archivo original.
 */
export async function compressProductImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY)
    // Navegadores sin codificador WebP devuelven PNG: usar JPEG en ese caso.
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
    if (!blob || blob.size >= file.size) return file

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'imagen'}.${ext}`
    return new File([blob], name, { type: blob.type, lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}
