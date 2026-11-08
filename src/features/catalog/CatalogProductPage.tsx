import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { formatDOP } from '@/lib/currency/format'
import { buildWhatsappLink } from '@/lib/utils/whatsapp'
import { useCatalogProduct, useCatalogRealtime, useStoreInfo } from './hooks'
import { AddToCartButton } from './cart/AddToCartButton'
import { ProductGallery } from './ProductGallery'

export default function CatalogProductPage() {
  useCatalogRealtime()
  const { slug = '' } = useParams()
  const product = useCatalogProduct(slug)
  const store = useStoreInfo()

  const storeName = store.data?.store_name ?? 'CoplinTech'
  useEffect(() => {
    if (product.data) document.title = `${product.data.name} · ${storeName}`
    return () => {
      document.title = storeName
    }
  }, [product.data, storeName])

  const back = (
    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
      <Link to="/catalogo">
        <ArrowLeft aria-hidden /> Volver al catálogo
      </Link>
    </Button>
  )

  if (product.isPending) return <LoadingState label="Cargando producto…" />
  if (product.isError)
    return (
      <>
        {back}
        <ErrorState error={product.error} title="No se pudo cargar el producto" onRetry={() => void product.refetch()} />
      </>
    )
  if (!product.data)
    return (
      <>
        {back}
        <EmptyState title="Producto no disponible" description="Este producto no existe o ya no está publicado en el catálogo." />
      </>
    )

  const p = product.data
  const productUrl = `${window.location.origin}/catalogo/${p.slug}`
  const whatsapp = buildWhatsappLink(store.data?.whatsapp_number, p.name, productUrl)

  return (
    <div>
      {back}
      {/* items-start: la galería no se estira al alto de la descripción; en escritorio queda fija al hacer scroll. */}
      <article className="grid items-start gap-6 md:grid-cols-2 md:gap-10">
        <div className="md:sticky md:top-20">
          <ProductGallery images={p.images?.length ? p.images : p.image_path ? [p.image_path] : []} alt={p.name} />
        </div>
        <div className="flex flex-col gap-4">
          <div>
            {(p.brand || p.category_name) && (
              <p className="text-sm text-muted-foreground">{[p.brand, p.category_name].filter(Boolean).join(' · ')}</p>
            )}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
          </div>
          <p className="text-3xl font-semibold tabular-nums">{formatDOP(p.sale_price)}</p>
          <AvailabilityBadge value={p.availability} className="self-start text-sm" />
          {p.description && <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{p.description}</p>}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <AddToCartButton
              size="lg"
              product={{ slug: p.slug, name: p.name, price: Number(p.sale_price), imagePath: p.image_path, availability: p.availability }}
            />
            {whatsapp ? (
              <Button asChild size="lg" variant="outline" className="border-emerald-600/60 text-emerald-300 hover:bg-emerald-600/10">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> Consultar solo este
                </a>
              </Button>
            ) : (
              <p className="self-center text-sm text-muted-foreground">El contacto por WhatsApp aún no está configurado.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Agrega varios productos al carrito y envíanos la lista por WhatsApp. La disponibilidad puede cambiar; no se realizan cobros ni reservas en línea.
          </p>
        </div>
      </article>
    </div>
  )
}
