import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { compressProductImage } from './compress-image'
import { makePrimary, MAX_PRODUCT_IMAGES, moveItem, removeAt, type GalleryItem } from './gallery'
import { validateImageFile, validateUploadImage } from './schema'

interface ProductGalleryEditorProps {
  items: GalleryItem[]
  onChange: (items: GalleryItem[]) => void
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}

/**
 * Galería del producto: varias imágenes, la primera es la principal (miniatura del
 * catálogo y del carrito). Las nuevas se optimizan en el navegador (WebP, 1200 px)
 * y se suben al guardar el producto.
 */
export function ProductGalleryEditor({ items, onChange, onBusyChange, disabled }: ProductGalleryEditorProps) {
  const [optimizing, setOptimizing] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const remaining = MAX_PRODUCT_IMAGES - items.length

  const discard = (item: GalleryItem) => {
    if (item.file) URL.revokeObjectURL(item.preview)
  }

  const addFiles = async (files: File[]) => {
    const problems: string[] = []
    if (files.length > remaining) problems.push(`Solo puedes agregar ${remaining} imagen(es) más (máximo ${MAX_PRODUCT_IMAGES}).`)
    const accepted = files.slice(0, Math.max(0, remaining)).filter((f) => {
      const err = validateImageFile(f)
      if (err) problems.push(`${f.name}: ${err}`)
      return !err
    })
    setErrors(problems)
    if (!accepted.length) return
    setOptimizing(accepted.length)
    onBusyChange?.(true)
    try {
      const added: GalleryItem[] = []
      for (const file of accepted) {
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
        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Sin imágenes</div>
      ) : (
        <ul className="grid grid-cols-2 gap-2" aria-label="Imágenes del producto">
          {items.map((item, index) => (
            <li key={item.key} className={cn('group relative overflow-hidden rounded-md border', index === 0 && 'col-span-2 ring-2 ring-foreground/60')}>
              <img src={item.preview} alt={`Imagen ${index + 1}${index === 0 ? ' (principal)' : ''}`} className="aspect-square w-full object-cover" />
              {index === 0 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
                  <Star className="size-3 fill-current" aria-hidden /> Principal
                </span>
              )}
              {item.file && (
                <span className="absolute top-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px]">Nueva · {Math.max(1, Math.round(item.file.size / 1024))} KB</span>
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
                  {index > 0 && (
                    <Button type="button" size="icon-xs" variant="secondary" disabled={busy} aria-label={`Usar imagen ${index + 1} como principal`} title="Usar como principal" onClick={() => onChange(makePrimary(items, index))}>
                      <Star aria-hidden />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    disabled={busy}
                    aria-label={`Quitar imagen ${index + 1}`}
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
          ))}
        </ul>
      )}

      <label
        aria-disabled={busy || remaining <= 0 || undefined}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-60"
      >
        {optimizing > 0 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {optimizing > 0 ? `Optimizando ${optimizing} imagen(es)…` : remaining > 0 ? `Agregar imágenes (${items.length}/${MAX_PRODUCT_IMAGES})` : `Máximo ${MAX_PRODUCT_IMAGES} imágenes`}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
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
        Puedes elegir varias a la vez. JPG, PNG o WebP (hasta 20 MB cada una); se optimizan a 1200 px en WebP. La primera es la principal: usa ★ para cambiarla. Los cambios se guardan al pulsar «Guardar».
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
