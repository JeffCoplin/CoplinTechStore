import { MessageCircle, Package, Radio } from 'lucide-react'
import { BRAND_ASSETS, BRAND_TAGLINE } from '@/components/navigation/Brand'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRealtimeStatus, useStoreWhatsappLink } from './hooks'

/**
 * Portada del catálogo: el ícono de CoplinTech "flota" sobre una cuadrícula
 * tenue (como un conector sobre una placa), con el lema de la marca.
 * Con un filtro activo se compacta, pero el logo sigue visible junto al
 * nombre de la categoría o búsqueda. La animación respeta prefers-reduced-motion.
 */
export function CatalogHero({ productCount, compact, heading }: { productCount: number | null; compact: boolean; heading: string }) {
  const realtime = useRealtimeStatus()
  const whatsapp = useStoreWhatsappLink()

  const mark = (
    <img
      src={BRAND_ASSETS.mark}
      alt=""
      aria-hidden
      width={464}
      height={376}
      className={cn(
        'shrink-0 select-none motion-safe:animate-float',
        compact
          ? 'w-14 drop-shadow-[0_8px_20px_rgba(255,255,255,0.16)] sm:w-20'
          : 'mx-auto w-44 drop-shadow-[0_18px_40px_rgba(255,255,255,0.18)] sm:w-56 md:w-64',
      )}
      draggable={false}
    />
  )

  return (
    <section
      aria-label="CoplinTech"
      className={cn(
        'relative isolate overflow-hidden rounded-2xl border bg-card',
        compact ? 'px-4 py-4 sm:px-6' : 'px-5 py-8 sm:px-10 sm:py-12',
      )}
    >
      {/* Cuadrícula tipo placa de circuito, desvanecida hacia los bordes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_70%_40%,black_20%,transparent_70%)]"
      />
      {/* Halo de luz detrás del ícono. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-96 rounded-full bg-white/[0.06] blur-3xl" />

      <div className={cn('grid items-center', compact ? 'grid-cols-[auto_1fr] gap-4 sm:gap-5' : 'gap-6 md:grid-cols-[1fr_auto]')}>
        {compact && mark}
        <div className={cn('flex min-w-0 flex-col', compact ? 'gap-2' : 'gap-4')}>
          <img src={BRAND_ASSETS.tagline} alt={BRAND_TAGLINE} width={692} height={36} className="h-3 w-auto self-start opacity-80 sm:h-3.5" />
          <h1 className={cn('font-semibold tracking-tight text-balance', compact ? 'truncate text-xl sm:text-2xl' : 'text-3xl sm:text-4xl')}>{heading}</h1>
          {!compact && (
            <p className="max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
              Precios en pesos dominicanos y disponibilidad al momento. Consúltanos por WhatsApp desde cualquier producto.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {productCount !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1">
                <Package className="size-3.5" aria-hidden /> {productCount} {productCount === 1 ? 'producto' : 'productos'}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1">
              {realtime === 'connected' ? (
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <Radio className="size-3.5" aria-hidden />
              )}
              {realtime === 'connected' ? 'Disponibilidad en vivo' : 'Disponibilidad actualizada'}
            </span>
            {whatsapp && !compact && (
              <Button asChild size="sm" className="h-7 rounded-full bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> Escríbenos
                </a>
              </Button>
            )}
          </div>
        </div>
        {!compact && mark}
      </div>
    </section>
  )
}
