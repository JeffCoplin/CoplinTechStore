import { useQuery } from '@tanstack/react-query'
import { Info, MessageCircle, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDOP } from '@/lib/currency/format'
import { supabase } from '@/lib/supabase/client'
import { ProductImage } from '../ProductImage'
import { useStoreInfo } from '../hooks'
import { buildCartWhatsappLink, cartCount, cartTotal, MAX_LINE_QUANTITY, refreshItems, sendableItems } from './cart'
import { cartStore, useCartItems, useCartOpen } from './store'

/** Botón del encabezado con el contador de unidades. */
export function CartButton() {
  const items = useCartItems()
  const count = cartCount(items)
  return (
    <Button variant="outline" size="sm" className="relative rounded-full" onClick={() => cartStore.setOpen(true)} aria-label={`Abrir carrito (${count} ${count === 1 ? 'unidad' : 'unidades'})`}>
      <ShoppingBag aria-hidden />
      <span className="hidden sm:inline">Carrito</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-background tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  )
}

/** Vuelve a consultar precio y disponibilidad de lo guardado (RPC pública segura). */
function useRefreshCart(open: boolean) {
  const items = useCartItems()
  const slugs = items.map((i) => i.slug).sort()
  const fresh = useQuery({
    queryKey: ['catalog', 'cart', slugs],
    enabled: open && slugs.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_catalog_products_by_slugs', { p_slugs: slugs })
      if (error) throw error
      return (data ?? []).map((p) => ({ slug: p.slug, name: p.name, price: Number(p.sale_price), imagePath: p.image_path, availability: p.availability }))
    },
  })

  useEffect(() => {
    if (!fresh.data) return
    const r = refreshItems(items, fresh.data)
    if (!r.changed) return
    cartStore.replace(r.items)
    if (r.removed.length) toast.info(`${r.removed.length === 1 ? 'Un producto ya no está' : `${r.removed.length} productos ya no están`} en el catálogo y se quitó del carrito.`)
    // Solo al recibir datos nuevos; `items` se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh.data])

  return fresh
}

export function CartSheet() {
  const open = useCartOpen()
  const items = useCartItems()
  const store = useStoreInfo()
  const fresh = useRefreshCart(open)
  const sendable = sendableItems(items)
  const soldOut = items.length - sendable.length
  const link = buildCartWhatsappLink(store.data?.whatsapp_number, items, window.location.origin, store.data?.store_name)

  return (
    <Sheet open={open} onOpenChange={cartStore.setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-4" aria-hidden /> Tu carrito
          </SheetTitle>
          <SheetDescription>Arma tu lista y envíanosla por WhatsApp. No se cobra ni se reserva nada en línea.</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <ShoppingBag className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Tu carrito está vacío</p>
            <p className="text-sm text-muted-foreground">Agrega productos desde el catálogo para consultarlos juntos.</p>
            <Button variant="outline" onClick={() => cartStore.setOpen(false)}>
              Ver productos
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-4" aria-label="Productos en el carrito" aria-busy={fresh.isFetching}>
              {items.map((i) => (
                <li key={i.slug} className="flex gap-3 py-3">
                  <Link to={`/catalogo/${i.slug}`} onClick={() => cartStore.setOpen(false)} className="shrink-0">
                    <ProductImage path={i.imagePath} alt={i.name} className="size-16 rounded-md border" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link to={`/catalogo/${i.slug}`} onClick={() => cartStore.setOpen(false)} className="line-clamp-2 text-sm font-medium hover:underline">
                      {i.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm tabular-nums">{formatDOP(i.price)}</span>
                      <AvailabilityBadge value={i.availability} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1" role="group" aria-label={`Cantidad de ${i.name}`}>
                        <Button variant="outline" size="icon-xs" aria-label="Quitar una" onClick={() => cartStore.setQuantity(i.slug, i.quantity - 1)}>
                          <Minus aria-hidden />
                        </Button>
                        <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">
                          {i.quantity}
                        </span>
                        <Button variant="outline" size="icon-xs" aria-label="Agregar una" disabled={i.quantity >= MAX_LINE_QUANTITY} onClick={() => cartStore.setQuantity(i.slug, i.quantity + 1)}>
                          <Plus aria-hidden />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon-xs" aria-label={`Quitar ${i.name} del carrito`} onClick={() => cartStore.remove(i.slug)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <SheetFooter className="gap-3 border-t p-4">
              {soldOut > 0 && (
                <p className="flex items-start gap-2 text-xs text-amber-300">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {soldOut === 1 ? 'Un producto está agotado y no se incluirá' : `${soldOut} productos están agotados y no se incluirán`} en el mensaje.
                </p>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total estimado</span>
                <span className="text-xl font-semibold tabular-nums">{formatDOP(cartTotal(sendable))}</span>
              </div>
              {link ? (
                <Button asChild size="lg" className="bg-emerald-600 text-white hover:bg-emerald-500">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden /> Enviar por WhatsApp
                  </a>
                </Button>
              ) : (
                <Button size="lg" disabled>
                  <MessageCircle aria-hidden /> {sendable.length === 0 ? 'No hay productos disponibles' : 'WhatsApp no configurado'}
                </Button>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Precios del catálogo; confirmamos disponibilidad por WhatsApp.</p>
                <Button variant="ghost" size="sm" onClick={() => cartStore.clear()}>
                  Vaciar
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
