import { ArrowDownUp, Search, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDOP } from '@/lib/currency/format'
import { cn } from '@/lib/utils'
import { CATALOG_PAGE_SIZE, CATALOG_SORTS, parseCatalogSort, useCatalogCategories, useCatalogProducts, useCatalogRealtime, useRealtimeStatus } from './hooks'
import { AddToCartButton } from './cart/AddToCartButton'
import { CatalogHero } from './CatalogHero'
import { ProductImage } from './ProductImage'
import { TrustStrip } from './TrustStrip'

export default function CatalogPage() {
  useCatalogRealtime()
  const realtime = useRealtimeStatus()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const category = params.get('categoria')
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1) || 0
  const sort = parseCatalogSort(params.get('orden'))
  const [draft, setDraft] = useState(search)
  // Si la URL cambia desde fuera (atrás/adelante, "Ver todos"), el campo se sincroniza.
  const [lastSearch, setLastSearch] = useState(search)
  if (lastSearch !== search) {
    setLastSearch(search)
    setDraft(search)
  }

  // Búsqueda con pequeño retardo para no consultar en cada tecla.
  useEffect(() => {
    if (draft === search) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (draft.trim()) next.set('q', draft.trim())
      else next.delete('q')
      next.delete('pagina')
      setParams(next, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [draft, search, params, setParams])

  const categories = useCatalogCategories()
  const products = useCatalogProducts(search, category, page, sort)
  const compact = Boolean(search || category || page > 0)
  const categoryName = categories.data?.find((c) => c.slug === category)?.name
  const heading = search ? `Resultados para “${search}”` : category ? (categoryName ?? 'Catálogo de productos') : 'Catálogo de productos'

  const setCategory = (slug: string | null) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('categoria', slug)
    else next.delete('categoria')
    next.delete('pagina')
    setParams(next)
  }

  const setSort = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('orden', value)
    else next.delete('orden')
    next.delete('pagina')
    setParams(next, { replace: true })
  }

  return (
    // minmax(0,1fr): la fila de categorías con scroll horizontal no debe ensanchar la página en móvil.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <CatalogHero compact={compact} heading={heading} productCount={products.data ? products.data.total : null} />

      {!compact && <TrustStrip />}

      {/* Fija bajo el encabezado (h-16) para cambiar de categoría sin volver arriba. */}
      <div className="sticky top-16 z-20 -mx-4 flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          <label htmlFor="catalog-search" className="sr-only">
            Buscar productos
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="catalog-search" type="search" placeholder="Buscar por nombre o marca…" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-10 pl-9" maxLength={80} />
          </div>
          <label htmlFor="catalog-sort" className="sr-only">
            Ordenar por
          </label>
          <div className="relative w-12 shrink-0 sm:w-56">
            <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <NativeSelect id="catalog-sort" value={sort ?? ''} onChange={(e) => setSort(e.target.value)} className="h-10 cursor-pointer pl-9 text-transparent sm:text-foreground">
              {CATALOG_SORTS.map((s) => (
                <option key={s.label} value={s.value ?? ''} className="text-foreground">
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {categories.data && categories.data.length > 0 && (
          <div
            role="group"
            aria-label="Filtrar por categoría"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <CategoryChip active={!category} onClick={() => setCategory(null)}>
              Todas
            </CategoryChip>
            {categories.data.map((c) => (
              <CategoryChip key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
                {c.name}
              </CategoryChip>
            ))}
          </div>
        )}
      </div>

      {realtime === 'disconnected' && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <WifiOff className="size-3.5" aria-hidden /> Actualización en vivo no disponible; la página se revalida periódicamente.
        </p>
      )}

      {products.isPending ? (
        <LoadingState label="Cargando productos…" />
      ) : products.isError ? (
        <ErrorState
          error={products.error}
          title="No se pudo cargar el catálogo"
          onRetry={() => void products.refetch()}
        />
      ) : products.data.rows.length === 0 ? (
        <EmptyState
          title={search || category ? 'No encontramos productos con ese filtro' : 'Aún no hay productos publicados'}
          description={search || category ? 'Prueba con otra búsqueda o categoría.' : 'Vuelve pronto para ver nuestro catálogo.'}
          action={
            (search || category) && (
              <Button variant="outline" size="sm" onClick={() => setParams(new URLSearchParams())}>
                Ver todos
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4', products.isPlaceholderData && 'opacity-60')}>
            {products.data.rows.map((p) => (
              <li key={p.slug} className="flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/20">
                <Link
                  to={`/catalogo/${p.slug}`}
                  className="group flex flex-1 flex-col focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ProductImage path={p.image_path} alt={p.name} className="aspect-square w-full" />
                  <div className="flex flex-1 flex-col gap-1.5 p-3 pb-2">
                    {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                    <p className="line-clamp-2 text-sm font-medium group-hover:underline">{p.name}</p>
                    <p className="mt-auto pt-1 text-base font-semibold tabular-nums">{formatDOP(p.sale_price)}</p>
                    <AvailabilityBadge value={p.availability} className="self-start" />
                  </div>
                </Link>
                <div className="px-3 pb-3">
                  <AddToCartButton
                    product={{ slug: p.slug, name: p.name, price: Number(p.sale_price), imagePath: p.image_path, availability: p.availability }}
                    className="w-full"
                  />
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={CATALOG_PAGE_SIZE}
            total={products.data.total}
            onPageChange={(p) => {
              const next = new URLSearchParams(params)
              next.set('pagina', String(p + 1))
              setParams(next)
              window.scrollTo({ top: 0 })
            }}
          />
        </>
      )}
    </div>
  )
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? 'default' : 'outline'} aria-pressed={active} onClick={onClick} className="shrink-0 rounded-full">
      {children}
    </Button>
  )
}
