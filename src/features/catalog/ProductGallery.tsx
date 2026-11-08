import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { isVideoPath } from '@/lib/domain/media'
import { productImageUrl } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ProductImage } from './ProductImage'

/**
 * Video de la galería: se reproduce en silencio y en bucle mientras está a la vista
 * (con controles para activar el sonido) y se pausa al pasar a otra pieza.
 * Los videos verticales se muestran completos sobre fondo negro.
 */
function ProductVideo({ path, label, active }: { path: string; label: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (active) void video.play().catch(() => undefined)
    else video.pause()
  }, [active])
  return (
    <video
      ref={ref}
      src={productImageUrl(path) ?? undefined}
      aria-label={label}
      // Respaldo de play(): si se rechazó (pestaña en segundo plano), arranca al volver a estar visible.
      autoPlay={active}
      muted
      loop
      playsInline
      controls
      preload="metadata"
      className="aspect-square w-full bg-black object-contain"
    />
  )
}

/**
 * Galería del detalle de producto: videos primero, luego imágenes. Pieza grande con
 * flechas, deslizamiento táctil, teclado (← →) y miniaturas. Con una sola pieza se
 * muestra sin controles de carrusel.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)
  const count = images.length
  const current = Math.min(index, Math.max(0, count - 1))

  if (count <= 1) {
    const only = images[0] ?? null
    return isVideoPath(only) ? (
      <div className="overflow-hidden rounded-lg border">
        <ProductVideo path={only!} label={`Video de ${alt}`} active />
      </div>
    ) : (
      <ProductImage path={only} alt={alt} className="aspect-square w-full rounded-lg border" />
    )
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
        aria-label={`Imágenes y videos de ${alt}`}
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
              {isVideoPath(path) ? (
                <ProductVideo path={path} label={`${alt} — video ${i + 1} de ${count}`} active={i === current} />
              ) : (
                <ProductImage path={path} alt={`${alt} — imagen ${i + 1} de ${count}`} className="aspect-square w-full" />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(current - 1)}
          aria-label="Anterior"
          className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(current + 1)}
          aria-label="Siguiente"
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow backdrop-blur transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <span className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-xs tabular-nums backdrop-blur" aria-live="polite">
          {current + 1} / {count}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Miniaturas">
        {images.map((path, i) => {
          const video = isVideoPath(path)
          return (
            <button
              key={path}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={video ? `Ver video ${i + 1}` : `Ver imagen ${i + 1}`}
              aria-current={i === current}
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                i === current ? 'border-foreground' : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              {video ? (
                <>
                  <video src={`${productImageUrl(path) ?? ''}#t=0.1`} muted playsInline preload="metadata" className="size-full bg-black object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="size-5 fill-white text-white" aria-hidden />
                  </span>
                </>
              ) : (
                <img src={productImageUrl(path) ?? ''} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
