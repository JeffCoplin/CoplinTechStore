import { cn } from '@/lib/utils'

/** Wordmark textual de CoplinTech (sin logo oficial hasta que se proporcione). */
export function Brand({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn('flex flex-col leading-tight', className)}>
      <span className="text-lg font-semibold tracking-tight">
        Coplin<span className="text-sky-400">Tech</span>
      </span>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  )
}
