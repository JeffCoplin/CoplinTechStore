import { MessageCircle, ShoppingBag } from 'lucide-react'
import { formatDOP } from '@/lib/currency/format'
import { cartCount, cartTotal, sendableItems } from './cart/cart'
import { cartStore, useCartItems } from './cart/store'
import { useStoreWhatsappLink } from './hooks'

/**
 * Accesos siempre a mano en la esquina: WhatsApp de la tienda y, en móvil,
 * el carrito con su total cuando tiene productos (en escritorio ya está en el encabezado).
 */
export function FloatingActions() {
  const whatsapp = useStoreWhatsappLink()
  const items = useCartItems()
  const count = cartCount(items)

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom)]">
      {count > 0 && (
        <button
          type="button"
          onClick={() => cartStore.setOpen(true)}
          className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background shadow-lg shadow-black/40 transition-transform active:scale-95 sm:hidden"
        >
          <ShoppingBag className="size-4" aria-hidden />
          Ver carrito ({count > 99 ? '99+' : count}) · <span className="tabular-nums">{formatDOP(cartTotal(sendableItems(items)))}</span>
        </button>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className="group pointer-events-auto inline-flex size-14 items-center justify-center gap-2 rounded-full bg-emerald-600 text-white shadow-lg shadow-black/40 transition-[width,transform] hover:bg-emerald-500 active:scale-95 sm:w-auto sm:px-5"
        >
          <MessageCircle className="size-6 shrink-0" aria-hidden />
          <span className="hidden text-sm font-semibold sm:inline">Escríbenos</span>
        </a>
      )}
    </div>
  )
}
