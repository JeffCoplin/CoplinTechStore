import { Banknote, MessageCircle, Radio, Tag } from 'lucide-react'

/** Datos que dan confianza antes de escribir: cómo se paga y cómo se atiende. */
const ITEMS = [
  { icon: Banknote, title: 'Paga como prefieras', text: 'Efectivo, transferencia o tarjeta' },
  { icon: MessageCircle, title: 'Atención directa', text: 'Te respondemos por WhatsApp' },
  { icon: Radio, title: 'Disponibilidad real', text: 'Se actualiza con cada venta' },
  { icon: Tag, title: 'Precios claros', text: 'En pesos dominicanos (RD$)' },
] as const

export function TrustStrip() {
  return (
    <ul aria-label="Por qué comprar en CoplinTech" className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {ITEMS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-2.5 rounded-lg border bg-card/60 p-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
