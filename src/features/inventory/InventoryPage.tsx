import { PackagePlus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { Field } from '@/components/shared/Field'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { initialPeriodState, PeriodFilter, type PeriodState } from '@/components/shared/PeriodFilter'
import { EmptyState, QueryBoundary } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useProduct, type QuickProduct } from '@/features/products/api'
import { ProductPicker } from '@/features/products/ProductPicker'
import { formatDateTime } from '@/lib/dates/santo-domingo'
import { availabilityFor } from '@/lib/domain/availability'
import { validateMovement, type ManualMovementType } from '@/lib/domain/inventory'
import { MOVEMENT_TYPE_LABELS } from '@/lib/domain/payments'
import { toUserMessage } from '@/lib/supabase/errors'
import { cn } from '@/lib/utils'
import { useRecordMovement, useRestockList, useStockMovements } from './api'

interface SelectedProduct {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
  low_stock_threshold: number
}

export default function InventoryPage() {
  const [params, setParams] = useSearchParams()
  const productParam = params.get('producto')
  const preset = useProduct(productParam ?? undefined)
  const [picked, setPicked] = useState<SelectedProduct | null>(null)
  const selected: SelectedProduct | null = picked && picked.id === productParam ? picked : (preset.data ?? null)

  const select = (p: QuickProduct | null) => {
    setPicked(p)
    const next = new URLSearchParams(params)
    if (p) next.set('producto', p.id)
    else next.delete('producto')
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="Inventario" description="Entradas, ajustes con motivo e historial auditable. Las ventas y anulaciones registran sus movimientos automáticamente." />
      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Registrar y consultar</TabsTrigger>
          <TabsTrigger value="reposicion">Requieren reposición</TabsTrigger>
        </TabsList>
        <TabsContent value="movimientos" className="mt-4 grid gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Producto</CardTitle>
                <CardDescription>Selecciona el producto para registrar un movimiento o filtrar el historial.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <ProductPicker label="Buscar producto" includeInactive onSelect={(p) => select(p)} />
                {selected && (
                  <div className="flex items-start justify-between gap-2 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{selected.name}</p>
                      <p className="text-xs text-muted-foreground">{selected.sku ?? 'Sin SKU'}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-lg font-semibold tabular-nums">{selected.stock_quantity}</span>
                        <span className="text-xs text-muted-foreground">en existencia</span>
                        <AvailabilityBadge value={availabilityFor(selected.stock_quantity, selected.low_stock_threshold)} />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Quitar selección" onClick={() => select(null)}>
                      <X aria-hidden />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            {selected ? (
              <MovementForm
                key={selected.id}
                product={selected}
                onRecorded={(after) => setPicked({ ...selected, stock_quantity: after })}
              />
            ) : (
              <EmptyState title="Selecciona un producto" description="Busca un producto para registrar una entrada de mercancía o un ajuste." />
            )}
          </div>
          <MovementsHistory productId={selected?.id ?? null} productName={selected?.name} />
        </TabsContent>
        <TabsContent value="reposicion" className="mt-4">
          <RestockList />
        </TabsContent>
      </Tabs>
    </>
  )
}

function MovementForm({ product, onRecorded }: { product: SelectedProduct; onRecorded: (after: number) => void }) {
  const record = useRecordMovement()
  const [type, setType] = useState<ManualMovementType>('restock')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const qty = Number(quantity)
  const delta = type === 'restock' ? qty : qty * direction

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateMovement({ type, delta, reason }, product.stock_quantity)
    setError(err)
    if (err || record.isPending) return
    record.mutate(
      { productId: product.id, type, delta, reason },
      {
        onSuccess: (m) => {
          toast.success(`${MOVEMENT_TYPE_LABELS[type]} registrada. Nueva existencia: ${m.quantity_after}`)
          setQuantity('')
          setReason('')
          onRecorded(m.quantity_after)
        },
        onError: (e) => setError(toUserMessage(e)),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field id="mv-type" label="Tipo">
            <NativeSelect id="mv-type" value={type} onChange={(e) => setType(e.target.value as ManualMovementType)}>
              <option value="restock">Entrada de mercancía</option>
              <option value="adjustment">Ajuste</option>
            </NativeSelect>
          </Field>
          {type === 'adjustment' && (
            <Field id="mv-direction" label="Dirección del ajuste">
              <NativeSelect id="mv-direction" value={String(direction)} onChange={(e) => setDirection(Number(e.target.value) as 1 | -1)}>
                <option value="1">Aumentar (+)</option>
                <option value="-1">Disminuir (−)</option>
              </NativeSelect>
            </Field>
          )}
          <Field id="mv-qty" label="Cantidad" required>
            <Input id="mv-qty" type="number" inputMode="numeric" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field id="mv-reason" label={type === 'adjustment' ? 'Motivo' : 'Nota (opcional)'} required={type === 'adjustment'} className="sm:col-span-2">
            <Textarea id="mv-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'adjustment' ? 'Ej.: producto dañado, conteo físico…' : 'Ej.: compra a proveedor'} />
          </Field>
          {Number.isInteger(qty) && qty > 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Existencia: {product.stock_quantity} → <span className="font-medium text-foreground">{product.stock_quantity + delta}</span>
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <Button type="submit" disabled={record.isPending} className="sm:col-span-2 sm:justify-self-start">
            <PackagePlus aria-hidden /> {record.isPending ? 'Registrando…' : 'Registrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function MovementsHistory({ productId, productName }: { productId: string | null; productName?: string }) {
  const [period, setPeriod] = useState<PeriodState>(() => initialPeriodState('thisMonth'))
  const [type, setType] = useState('all')
  const [page, setPage] = useState(0)
  const movements = useStockMovements({ productId, type, period: period.period, page })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de movimientos</CardTitle>
        <CardDescription>{productName ? `Producto: ${productName}` : 'Todos los productos'}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter value={period} onChange={(v) => { setPeriod(v); setPage(0) }} />
          <div className="grid gap-1.5">
            <Label htmlFor="mv-filter-type">Tipo</Label>
            <NativeSelect id="mv-filter-type" className="w-48" value={type} onChange={(e) => { setType(e.target.value); setPage(0) }}>
              <option value="all">Todos</option>
              {Object.entries(MOVEMENT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <QueryBoundary query={movements}>
          {movements.data?.rows.length === 0 ? (
            <EmptyState title="Sin movimientos en este período" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cambio</TableHead>
                      <TableHead className="text-right">Antes → Después</TableHead>
                      <TableHead>Motivo / Referencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.data?.rows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(m.created_at)}</TableCell>
                        <TableCell>{m.products?.name ?? '—'}</TableCell>
                        <TableCell>{MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}</TableCell>
                        <TableCell className={cn('text-right font-medium tabular-nums', m.quantity_delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {m.quantity_delta > 0 ? `+${m.quantity_delta}` : `−${Math.abs(m.quantity_delta)}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {m.quantity_before} → {m.quantity_after}
                        </TableCell>
                        <TableCell className="max-w-64 truncate" title={m.reason ?? undefined}>
                          {m.sale_id && m.sales ? (
                            <Link to={`/admin/ventas/${m.sale_id}`} className="underline-offset-4 hover:underline">
                              {m.sales.sale_number}
                            </Link>
                          ) : null}
                          {m.sale_id && m.reason ? ' · ' : ''}
                          {m.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={page} total={movements.data?.total ?? 0} onPageChange={setPage} />
            </>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function RestockList() {
  const list = useRestockList()
  return (
    <QueryBoundary query={list}>
      {list.data?.length === 0 ? (
        <EmptyState title="Todo en orden" description="No hay productos activos con pocas unidades ni agotados." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Existencia</TableHead>
                <TableHead className="text-right">Umbral</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.sku ?? 'Sin SKU'}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.stock_quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.low_stock_threshold}</TableCell>
                  <TableCell>
                    <AvailabilityBadge value={p.availability} />
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/inventario?producto=${p.id}`}>Reponer</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </QueryBoundary>
  )
}
