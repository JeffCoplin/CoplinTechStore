import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'
import { Brand } from '@/components/navigation/Brand'
import { LoadingState } from '@/components/shared/states'
import { CartButton, CartSheet } from '@/features/catalog/cart/CartSheet'
import { useStoreInfo } from '@/features/catalog/hooks'

const CURRENT_YEAR = new Date().getFullYear()

export function PublicLayout() {
  const store = useStoreInfo()
  const storeName = store.data?.store_name ?? 'CoplinTech'
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/catalogo" aria-label={`${storeName} — inicio del catálogo`}>
            <Brand subtitle="Catálogo de productos" />
          </Link>
          <CartButton />
        </div>
      </header>
      <CartSheet />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {CURRENT_YEAR} {storeName}. Precios en pesos dominicanos (RD$). Consulta disponibilidad antes de visitar la tienda.
      </footer>
    </div>
  )
}
