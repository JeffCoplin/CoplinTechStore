import { isVideoPath } from '@/lib/domain/media'

/** Máximo de imágenes y videos por producto (también lo valida set_product_images en la BD). */
export const MAX_PRODUCT_IMAGES = 8
/** Máximo de videos dentro de esas piezas (también validado en la BD). */
export const MAX_PRODUCT_VIDEOS = 2


/** Imagen de la galería en edición: ya subida (path) o nueva pendiente de subir (file). */
export interface GalleryItem {
  key: string
  path: string | null
  file: File | null
  /** URL para la vista previa (pública o blob:). */
  preview: string
}

export function isVideoItem(item: Pick<GalleryItem, 'path' | 'file'>): boolean {
  return item.file ? item.file.type.startsWith('video/') : isVideoPath(item.path)
}

/** Los videos siempre van primero (como en el catálogo); se conserva el orden de cada grupo. */
export function videosFirst(items: GalleryItem[]): GalleryItem[] {
  return [...items.filter(isVideoItem), ...items.filter((i) => !isVideoItem(i))]
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

/** Lleva la imagen al primer lugar (principal). */
export function makePrimary<T>(list: T[], index: number): T[] {
  return moveItem(list, index, 0)
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index)
}

/** ¿Cambió la galería respecto a lo guardado (orden, altas o bajas)? */
export function galleryChanged(items: GalleryItem[], original: string[]): boolean {
  if (items.some((i) => i.file)) return true
  const paths = items.map((i) => i.path)
  return paths.length !== original.length || paths.some((p, i) => p !== original[i])
}
