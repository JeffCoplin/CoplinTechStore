import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { productImageUrl } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ProductImage } from './ProductImage'

/**
 * Galería del detalle de producto: imagen grande con flechas, deslizamiento
 * táctil, teclado (← →) y miniaturas. Con una sola imagen se comporta como antes.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)
  const count = images.length
  const current = Math.min(index, Math.max(0, count - 1))

  if (count <= 1) {
    return <ProductImage path={images[0] ?? null} alt={alt} className="aspect-square w-full rounded-lg border" />
  }

  const go = (next: number) => setIndex((next + count) % count)

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(current + 1)
    else if (e.key === 'ArrowLeft') go(current - 1)
  }
  const onPointerDown = (e: PointerEvent) => {
    startX.current = e.clientX
  }
  const onPointerUp = (e: PointerEvent) => {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (Math.abs(dx) > 40) go(dx < 0 ? current + 1 : current - 1)
  }

  return (
    <div className="grid gap-3">
      <div
        role="region"
        aria-roledescription="carrusel"
        aria-label={`Imágenes de ${alt}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (startX.current = null)}
        className="group relative touch-pan-y overflow-hidden rounded-lg border select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="flex transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${current * 100}%)` }}>
          {images.map((path, i) => (
            <div key={path} className="w-full shrink-0" aria-hidden={i !== current}>
              <ProductImage path={path} alt={`${alt} — imagen ${i + 1} de ${count}`} className="aspect-square w-full" />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(current - 1)}
          aria-label="Imagen anterior"
          className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(current + 1)}
          aria-label="Imagen siguiente"
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <span className="absolute right-2 bottom-2 rounded-full bg-background/80 px-2 py-0.5 text-xs tabular-nums backdrop-blur" aria-live="polite">
          {current + 1} / {count}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Miniaturas">
        {images.map((path, i) => (
          <button
            key={path}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Ver imagen ${i + 1}`}
            aria-current={i === current}
            className={cn(
              'size-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              i === current ? 'border-foreground' : 'border-transparent opacity-60 hover:opacity-100',
            )}
          >
            <img src={productImageUrl(path) ?? ''} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
