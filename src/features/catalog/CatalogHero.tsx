import { MessageCircle, Package, Radio } from 'lucide-react'
import { BRAND_ASSETS, BRAND_TAGLINE } from '@/components/navigation/Brand'
import { Button } from '@/components/ui/button'
import { buildWhatsappLink } from '@/lib/utils/whatsapp'
import { cn } from '@/lib/utils'
import { useRealtimeStatus, useStoreInfo } from './hooks'

/**
 * Portada del catálogo: el ícono de CoplinTech "flota" sobre una cuadrícula
 * tenue (como un conector sobre una placa), con el lema de la marca.
 * La animación se desactiva con prefers-reduced-motion.
 */
export function CatalogHero({ productCount, compact }: { productCount: number | null; compact: boolean }) {
  const store = useStoreInfo()
  const realtime = useRealtimeStatus()
  const whatsapp = buildWhatsappLink(store.data?.whatsapp_number, 'el catálogo', `${window.location.origin}/catalogo`)?.replace(
    encodeURIComponent('me interesa este producto: el catálogo'),
    encodeURIComponent('vi su catálogo y tengo una consulta.'),
  )

  return (
    <section
      aria-label="CoplinTech"
      className={cn(
        'relative isolate overflow-hidden rounded-2xl border bg-card',
        compact ? 'px-5 py-5' : 'px-5 py-8 sm:px-10 sm:py-12',
      )}
    >
      {/* Cuadrícula tipo placa de circuito, desvanecida hacia los bordes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_70%_40%,black_20%,transparent_70%)]"
      />
      {/* Halo de luz detrás del ícono. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-96 rounded-full bg-white/[0.06] blur-3xl" />

      <div className={cn('grid items-center gap-6', !compact && 'md:grid-cols-[1fr_auto]')}>
        <div className="flex flex-col gap-4">
          <img src={BRAND_ASSETS.tagline} alt={BRAND_TAGLINE} width={692} height={36} className="h-3 w-auto self-start opacity-80 sm:h-3.5" />
          {compact && <h1 className="sr-only">Catálogo de productos</h1>}
          {!compact && (
            <>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Catálogo de productos</h1>
              <p className="max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
                Precios en pesos dominicanos y disponibilidad al momento. Consúltanos por WhatsApp desde cualquier producto.
              </p>
            </>
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
            {whatsapp && (
              <Button asChild size="sm" className="h-7 rounded-full bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> Escríbenos
                </a>
              </Button>
            )}
          </div>
        </div>

        {!compact && (
          <img
            src={BRAND_ASSETS.mark}
            alt=""
            aria-hidden
            width={464}
            height={376}
            className="mx-auto w-44 select-none drop-shadow-[0_18px_40px_rgba(255,255,255,0.18)] motion-safe:animate-float sm:w-56 md:w-64"
            draggable={false}
          />
        )}
      </div>
    </section>
  )
}
