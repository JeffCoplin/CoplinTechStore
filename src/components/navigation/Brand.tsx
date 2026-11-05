import { cn } from '@/lib/utils'

export const BRAND_ASSETS = {
  mark: '/brand/logo-mark.png',
  wordmark: '/brand/logo-wordmark.png',
  tagline: '/brand/logo-tagline.png',
  full: '/brand/logo-full.png',
} as const

export const BRAND_TAGLINE = 'Conectando tecnología y calidad'

interface BrandProps {
  className?: string
  /** Texto pequeño bajo el wordmark (p. ej. "Panel de administración"). */
  subtitle?: string
  /** horizontal: ícono + COPLINTECH (encabezados). stacked: logo completo con lema. */
  variant?: 'horizontal' | 'stacked'
}

/** Logo oficial de CoplinTech (blanco sobre transparente, pensado para el tema oscuro). */
export function Brand({ className, subtitle, variant = 'horizontal' }: BrandProps) {
  if (variant === 'stacked') {
    return <img src={BRAND_ASSETS.full} alt={`CoplinTech — ${BRAND_TAGLINE}`} width={878} height={540} className={cn('h-auto w-full max-w-64 select-none', className)} draggable={false} />
  }
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={BRAND_ASSETS.mark} alt="" aria-hidden width={464} height={376} className="h-8 w-auto shrink-0 select-none" draggable={false} />
      <div className="flex min-w-0 flex-col gap-1">
        <img src={BRAND_ASSETS.wordmark} alt="CoplinTech" width={878} height={82} className="h-3.5 w-auto select-none" draggable={false} />
        {subtitle && <span className="truncate text-[11px] leading-none text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  )
}
