import { Eye, EyeOff, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState, QueryBoundary } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCategories } from '@/features/categories/api'
import { ProductImage } from '@/features/catalog/ProductImage'
import { formatDOP } from '@/lib/currency/format'
import { availabilityFor } from '@/lib/domain/availability'
import { toUserMessage } from '@/lib/supabase/errors'
import { useProducts, useToggleProduct, type ProductStatusFilter } from './api'

const STATUS_OPTIONS: { value: ProductStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'published', label: 'Publicados' },
  { value: 'unpublished', label: 'No publicados' },
  { value: 'out', label: 'Agotados' },
]

export default function ProductsPage() {
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProductStatusFilter>('all')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const categories = useCategories()
  const products = useProducts({ search, status, categoryId, page })
  const toggle = useToggleProduct()

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchDraft)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchDraft])

  return (
    <>
      <PageHeader
        title="Productos"
        description="Las existencias se modifican desde Inventario para conservar el historial."
        actions={
          <Button asChild>
            <Link to="/admin/productos/nuevo">
              <Plus aria-hidden /> Nuevo producto
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="product-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="product-search" type="search" className="pl-9" placeholder="Nombre, SKU o código de barras" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="product-status">Estado</Label>
          <NativeSelect id="product-status" className="w-44" value={status} onChange={(e) => { setStatus(e.target.value as ProductStatusFilter); setPage(0) }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="product-category">Categoría</Label>
          <NativeSelect id="product-category" className="w-48" value={categoryId ?? ''} onChange={(e) => { setCategoryId(e.target.value || null); setPage(0) }}>
            <option value="">Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <QueryBoundary query={products} loadingLabel="Cargando productos…">
        {products.data?.rows.length === 0 ? (
          <EmptyState
            title={search || status !== 'all' || categoryId ? 'Ningún producto coincide con el filtro' : 'Aún no hay productos'}
            action={
              <Button asChild size="sm">
                <Link to="/admin/productos/nuevo">Crear producto</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Existencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.data?.rows.map((p) => (
                    <TableRow key={p.id} className={p.is_active ? undefined : 'opacity-60'}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ProductImage path={p.image_path} alt="" className="size-10 shrink-0 rounded" />
                          <div className="min-w-0">
                            <Link to={`/admin/productos/${p.id}`} className="font-medium hover:underline">
                              {p.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{p.sku ?? 'Sin SKU'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.categories?.name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDOP(p.cost_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDOP(p.sale_price)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular-nums">{p.stock_quantity}</span>
                          <AvailabilityBadge value={availabilityFor(p.stock_quantity, p.low_stock_threshold)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={p.is_active ? 'secondary' : 'outline'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                          <Badge variant="outline">{p.is_published ? 'Publicado' : 'Oculto'}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={toggle.isPending}
                          aria-label={p.is_published ? `Ocultar ${p.name} del catálogo` : `Publicar ${p.name} en el catálogo`}
                          title={p.is_published ? 'Ocultar del catálogo' : 'Publicar en el catálogo'}
                          onClick={() =>
                            toggle.mutate(
                              { id: p.id, patch: { is_published: !p.is_published } },
                              {
                                onSuccess: () => toast.success(p.is_published ? 'Producto oculto del catálogo' : 'Producto publicado'),
                                onError: (e) => toast.error(toUserMessage(e)),
                              },
                            )
                          }
                        >
                          {p.is_published ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                        </Button>
                        <Button variant="ghost" size="icon" asChild aria-label={`Editar ${p.name}`}>
                          <Link to={`/admin/productos/${p.id}`}>
                            <Pencil aria-hidden />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} total={products.data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </QueryBoundary>
    </>
  )
}
