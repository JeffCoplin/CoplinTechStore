import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Play, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { compressProductImage } from './compress-image'
import { isVideoItem, makePrimary, MAX_PRODUCT_IMAGES, MAX_PRODUCT_VIDEOS, moveItem, removeAt, videosFirst, type GalleryItem } from './gallery'
import { canPlayVideo } from './probe-video'
import { validateImageFile, validateUploadImage, validateVideoFile } from './schema'

interface ProductGalleryEditorProps {
  items: GalleryItem[]
  onChange: (items: GalleryItem[]) => void
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}

/**
 * Galería del producto: imágenes y videos. Los videos van siempre primero (así se
 * muestran en el catálogo); la primera imagen es la principal (miniatura del catálogo
 * y del carrito). Las imágenes nuevas se optimizan en el navegador (WebP, 1200 px);
 * los videos se suben tal cual. Todo se sube al guardar el producto.
 */
export function ProductGalleryEditor({ items, onChange: setItems, onBusyChange, disabled }: ProductGalleryEditorProps) {
  const [optimizing, setOptimizing] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const remaining = MAX_PRODUCT_IMAGES - items.length
  const onChange = (next: GalleryItem[]) => setItems(videosFirst(next))
  const firstImage = items.findIndex((i) => !isVideoItem(i))

  const discard = (item: GalleryItem) => {
    if (item.file) URL.revokeObjectURL(item.preview)
  }

  const addFiles = async (files: File[]) => {
    const problems: string[] = []
    if (files.length > remaining) problems.push(`Solo puedes agregar ${remaining} imagen(es) más (máximo ${MAX_PRODUCT_IMAGES}).`)
    const isVideo = (f: File) => f.type.startsWith('video/')
    const valid = files.slice(0, Math.max(0, remaining)).filter((f) => {
      const err = isVideo(f) ? validateVideoFile(f) : validateImageFile(f)
      if (err) problems.push(`${f.name}: ${err}`)
      return !err
    })
    const videoSlots = Math.max(0, MAX_PRODUCT_VIDEOS - items.filter(isVideoItem).length)
    const allowedVideos = new Set(valid.filter(isVideo).slice(0, videoSlots))
    const accepted = valid.filter((f) => {
      if (!isVideo(f) || allowedVideos.has(f)) return true
      problems.push(`${f.name}: máximo ${MAX_PRODUCT_VIDEOS} videos por producto.`)
      return false
    })
    setErrors(problems)
    if (!accepted.length) return
    setOptimizing(accepted.length)
    onBusyChange?.(true)
    try {
      const added: GalleryItem[] = []
      for (const file of accepted) {
        if (file.type.startsWith('video/')) {
          if (await canPlayVideo(file)) added.push({ key: crypto.randomUUID(), path: null, file, preview: URL.createObjectURL(file) })
          else problems.push(`${file.name}: este navegador no puede reproducir el video. Si es de iPhone, expórtalo como MP4 (Ajustes › Cámara › Formatos › Más compatible).`)
          setOptimizing((n) => n - 1)
          continue
        }
        const optimized = await compressProductImage(file).catch(() => file)
        const err = validateUploadImage(optimized)
        if (err) problems.push(`${file.name}: ${err}`)
        else added.push({ key: crypto.randomUUID(), path: null, file: optimized, preview: URL.createObjectURL(optimized) })
        setOptimizing((n) => n - 1)
      }
      setErrors(problems)
      onChange([...items, ...added])
    } finally {
      setOptimizing(0)
      onBusyChange?.(false)
    }
  }

  const busy = disabled || optimizing > 0

  return (
    <div className="grid gap-3">
      {items.length === 0 ? (
        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Sin imágenes ni videos</div>
      ) : (
        <ul className="grid grid-cols-2 gap-2" aria-label="Imágenes y videos del producto">
          {items.map((item, index) => {
            const video = isVideoItem(item)
            return (
            <li key={item.key} className={cn('group relative overflow-hidden rounded-md border', index === firstImage && 'col-span-2 ring-2 ring-foreground/60')}>
              {video ? (
                <video src={`${item.preview}#t=0.1`} muted playsInline preload="metadata" aria-label={`Video ${index + 1}`} className="aspect-square w-full bg-black object-contain" />
              ) : (
                <img src={item.preview} alt={`Imagen ${index + 1}${index === firstImage ? ' (principal)' : ''}`} className="aspect-square w-full object-cover" />
              )}
              {video ? (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
                  <Play className="size-3 fill-current" aria-hidden /> Video
                </span>
              ) : (
                index === firstImage && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
                    <Star className="size-3 fill-current" aria-hidden /> Principal
                  </span>
                )
              )}
              {item.file && (
                <span className="absolute top-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px]">
                  Nueva · {item.file.size >= 1024 * 1024 ? `${(item.file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(item.file.size / 1024))} KB`}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                <div className="flex gap-1">
                  <Button type="button" size="icon-xs" variant="secondary" disabled={busy || index === 0} aria-label={`Mover imagen ${index + 1} a la izquierda`} onClick={() => onChange(moveItem(items, index, index - 1))}>
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button type="button" size="icon-xs" variant="secondary" disabled={busy || index === items.length - 1} aria-label={`Mover imagen ${index + 1} a la derecha`} onClick={() => onChange(moveItem(items, index, index + 1))}>
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
                <div className="flex gap-1">
                  {!video && index !== firstImage && (
                    <Button type="button" size="icon-xs" variant="secondary" disabled={busy} aria-label={`Usar imagen ${index + 1} como principal`} title="Usar como principal" onClick={() => onChange(makePrimary(items, index))}>
                      <Star aria-hidden />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    disabled={busy}
                    aria-label={`Quitar ${video ? 'video' : 'imagen'} ${index + 1}`}
                    title="Quitar"
                    onClick={() => {
                      discard(item)
                      onChange(removeAt(items, index))
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
            )
          })}
        </ul>
      )}

      <label
        aria-disabled={busy || remaining <= 0 || undefined}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-60"
      >
        {optimizing > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {optimizing > 0 ? `Procesando ${optimizing} archivo(s)…` : remaining > 0 ? `Agregar fotos o videos (${items.length}/${MAX_PRODUCT_IMAGES})` : `Máximo ${MAX_PRODUCT_IMAGES} fotos y videos`}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          disabled={busy || remaining <= 0}
          aria-describedby="p-gallery-hint"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void addFiles(files)
          }}
        />
      </label>
      <p id="p-gallery-hint" className="text-xs text-muted-foreground">
        Puedes elegir varios a la vez. Fotos JPG, PNG o WebP (hasta 20 MB; se optimizan a 1200 px en WebP). Videos MP4, WebM o MOV (hasta {MAX_PRODUCT_VIDEOS}, de 50 MB cada uno): en el catálogo salen antes que las fotos. La primera foto es la principal: usa ★ para cambiarla. Los cambios se guardan al pulsar «Guardar».
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="grid gap-0.5 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
