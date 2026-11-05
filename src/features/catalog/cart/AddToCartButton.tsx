import { Check, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CartProduct } from './cart'
import { cartStore, useCartItems } from './store'

interface AddToCartButtonProps {
  product: CartProduct
  size?: 'sm' | 'lg'
  className?: string
}

export function AddToCartButton({ product, size = 'sm', className }: AddToCartButtonProps) {
  const items = useCartItems()
  const inCart = items.find((i) => i.slug === product.slug)
  const soldOut = product.availability === 'out_of_stock'

  if (soldOut) {
    return (
      <Button type="button" variant="outline" size={size} disabled className={className}>
        Agotado
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      variant={inCart ? 'secondary' : 'default'}
      className={cn(className)}
      aria-label={inCart ? `Agregar otra unidad de ${product.name} (tienes ${inCart.quantity})` : `Agregar ${product.name} al carrito`}
      onClick={() => {
        cartStore.add(product)
        toast.success('Agregado al carrito', {
          description: product.name,
          action: { label: 'Ver carrito', onClick: () => cartStore.setOpen(true) },
        })
      }}
    >
      {inCart ? <Check aria-hidden /> : <ShoppingBag aria-hidden />}
      {inCart ? `En el carrito (${inCart.quantity})` : size === 'lg' ? 'Agregar al carrito' : 'Agregar'}
    </Button>
  )
}
