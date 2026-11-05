import { ArrowLeft, Ban, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Field } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useStoreSettings } from '@/features/settings/api'
import { formatDOP } from '@/lib/currency/format'
import { formatDateTime } from '@/lib/dates/santo-domingo'
import { paymentMethodLabel, SALE_STATUS_LABELS } from '@/lib/domain/payments'
import { toUserMessage } from '@/lib/supabase/errors'
import { useSale, useVoidSale } from './api'
import { Receipt } from './Receipt'

export default function SaleDetailPage() {
  const { id } = useParams()
  const sale = useSale(id)
  const settings = useStoreSettings()
  const voidSale = useVoidSale()
  const [voidOpen, setVoidOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (sale.isPending) return <LoadingState label="Cargando venta…" />
  if (sale.isError) return <ErrorState error={sale.error} onRetry={() => void sale.refetch()} />
  if (!sale.data) return <EmptyState title="Venta no encontrada" />

  const s = sale.data
  const cost = s.sale_items.reduce((acc, i) => acc + Number(i.unit_cost_price) * i.quantity, 0)

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 print:hidden">
        <Link to="/admin/ventas">
          <ArrowLeft aria-hidden /> Ventas
        </Link>
      </Button>
      <PageHeader
        title={`Venta ${s.sale_number}`}
        description={formatDateTime(s.created_at)}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden /> Imprimir recibo
            </Button>
            {s.status === 'completed' && (
              <Button variant="destructive" onClick={() => setVoidOpen(true)}>
                <Ban aria-hidden /> Anular venta
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Resumen <Badge variant={s.status === 'voided' ? 'destructive' : 'secondary'}>{SALE_STATUS_LABELS[s.status]}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Item label="Subtotal" value={formatDOP(s.subtotal)} />
                <Item label="Descuento" value={formatDOP(s.discount_amount)} />
                <Item label="Total" value={formatDOP(s.total)} strong />
                <Item label="Método" value={paymentMethodLabel(s.payment_method)} />
                {s.payment_method === 'cash' && (
                  <>
                    <Item label="Recibido" value={formatDOP(s.amount_received)} />
                    <Item label="Cambio" value={formatDOP(s.change_amount)} />
                  </>
                )}
                <Item label="Costo vendido" value={formatDOP(cost)} />
                <Item label="Ganancia bruta" value={formatDOP(Number(s.total) - cost)} />
              </dl>
              {s.note && <p className="mt-4 text-sm text-muted-foreground">Nota: {s.note}</p>}
              {s.status === 'voided' && (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium">Anulada el {s.voided_at ? formatDateTime(s.voided_at) : '—'}</p>
                  <p className="text-muted-foreground">Motivo: {s.void_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Artículos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.sale_items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.product_id ? (
                            <Link to={`/admin/productos/${i.product_id}`} className="hover:underline">
                              {i.product_name_snapshot}
                            </Link>
                          ) : (
                            i.product_name_snapshot
                          )}
                          <span className="block text-xs text-muted-foreground">{i.sku_snapshot ?? 'Sin SKU'}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDOP(i.unit_sale_price)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatDOP(i.unit_cost_price)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDOP(i.line_subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:w-80">
          <Receipt sale={s} storeName={settings.data?.store_name ?? 'CoplinTech'} />
        </div>
      </div>

      <ConfirmDialog
        open={voidOpen}
        onOpenChange={(o) => {
          setVoidOpen(o)
          if (!o) setReason('')
        }}
        title={`Anular venta ${s.sale_number}`}
        description="Se restaurarán las existencias con movimientos compensatorios. La venta se conserva como anulada y deja de contar en los reportes. Esta acción no se puede deshacer."
        confirmLabel="Anular venta"
        destructive
        pending={voidSale.isPending}
        confirmDisabled={reason.trim() === ''}
        onConfirm={() =>
          voidSale.mutate(
            { saleId: s.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast.success('Venta anulada y existencias restauradas')
                setVoidOpen(false)
                setReason('')
              },
              onError: (e) => toast.error(toUserMessage(e)),
            },
          )
        }
      >
        <Field id="void-reason" label="Motivo de la anulación" required>
          <Textarea id="void-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: devolución del cliente, error de registro…" />
        </Field>
      </ConfirmDialog>
    </>
  )
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? 'text-lg font-semibold tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  )
}
