import { useSyncExternalStore } from 'react'
import { addItem, parseStoredCart, removeItem, setQuantity, type CartItem, type CartProduct } from './cart'

/**
 * Estado del carrito de consulta, persistido en localStorage del visitante
 * (si está disponible) y sincronizado entre pestañas.
 */

const STORAGE_KEY = 'coplintech-cart-v1'

function load(): CartItem[] {
  try {
    return parseStoredCart(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

let items: CartItem[] = typeof window === 'undefined' ? [] : load()
let open = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function commit(next: CartItem[]) {
  if (next === items) return
  items = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* almacenamiento no disponible (modo privado): el carrito vive solo en memoria */
  }
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      items = load()
      emit()
    }
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const cartStore = {
  add: (product: CartProduct, qty = 1) => commit(addItem(items, product, qty)),
  setQuantity: (slug: string, qty: number) => commit(setQuantity(items, slug, qty)),
  remove: (slug: string) => commit(removeItem(items, slug)),
  replace: (next: CartItem[]) => commit(next),
  clear: () => commit([]),
  setOpen: (value: boolean) => {
    if (open === value) return
    open = value
    emit()
  },
}

export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items)
}

export function useCartOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open)
}
