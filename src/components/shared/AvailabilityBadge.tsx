import { CircleCheck, CircleAlert, CircleX } from 'lucide-react'
import { AVAILABILITY_LABELS, isAvailability, type Availability } from '@/lib/domain/availability'
import { cn } from '@/lib/utils'

const STYLES: Record<Availability, string> = {
  available: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  low_stock: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  out_of_stock: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const ICONS = { available: CircleCheck, low_stock: CircleAlert, out_of_stock: CircleX } as const

/** Estado con icono + texto: no depende solo del color. */
export function AvailabilityBadge({ value, className }: { value: string; className?: string }) {
  if (!isAvailability(value)) return null
  const Icon = ICONS[value]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', STYLES[value], className)}>
      <Icon className="size-3.5" aria-hidden />
      {AVAILABILITY_LABELS[value]}
    </span>
  )
}
