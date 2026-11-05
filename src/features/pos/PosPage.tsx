import { CheckCircle2, Minus, Plus, Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Field } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ProductPicker } from '@/features/products/ProductPicker'
import { useStoreSettings } from '@/features/settings/api'
import { formatDOP, parseMoneyInput } from '@/lib/currency/format'
import { addToCart, computeCartTotals, removeLine, setLineQuantity, toSaleItemsPayload, validateCart, type CartLine } from '@/lib/domain/cart'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/lib/domain/payments'
import { errorHint, toUserMessage } from '@/lib/supabase/errors'
import { cn } from '@/lib/utils'
import { useCreateSale, useSale } from '@/features/sales/api'
import { Receipt } from '@/features/sales/Receipt'

export default function PosPage() {
  const createSale = useCreateSale()
  const searchRef = useRef<HTMLInputElement>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [discountRaw, setDiscountRaw] = useState('')
  const [receivedRaw, setReceivedRaw] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  // Clave de idempotencia de la venta en curso. Se conserva en reintentos (aunque
  // se edite el carrito: si un intento anterior sí se guardó, la BD devuelve esa
  // misma venta en vez de duplicarla) y solo se renueva al completar o vaciar.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null)

  const discount = parseMoneyInput(discountRaw) ?? 0
  const received = parseMoneyInput(receivedRaw)
  const totals = computeCartTotals(lines, discount, received, method)

  const updateLines = (next: CartLine[]) => {
    setLines(next)
    setErrors([])
  }

  const reset = () => {
    setLines([])
    setDiscountRaw('')
    setReceivedRaw('')
    setNote('')
    setErrors([])
    setMethod('cash')
    setRequestId(crypto.randomUUID())
  }

  const confirm = () => {
    if (createSale.isPending) return
    const v = validateCart(lines, discountRaw.trim() === '' ? 0 : (parseMoneyInput(discountRaw) ?? Number.NaN), received, method)
    setErrors(v.errors)
    if (!v.ok) return
    createSale.mutate(
      {
        clientRequestId: requestId,
        items: toSaleItemsPayload(lines),
        paymentMethod: method,
        discount,
        amountReceived: received,
        note,
      },
      {
        onSuccess: (r) => {
          if (r.already_existed) toast.info(`La venta ${r.sale_number} ya se había registrado; no se duplicó.`)
          else toast.success(`Venta ${r.sale_number} registrada`)
          setCompletedSaleId(r.sale_id)
          reset()
        },
        onError: (e) => {
          setErrors([toUserMessage(e, 'No se pudo registrar la venta. Puedes reintentar sin riesgo de duplicarla.')])
          if (errorHint(e) === 'insufficient_stock') toast.error('Existencia insuficiente: revisa las cantidades.')
        },
      },
    )
  }

  return (
    <>
      <PageHeader title="Nueva venta" description="Venta física. Los precios y totales definitivos los calcula y valida la base de datos." />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-4">
          <ProductPicker
            label="Añadir producto"
            inputRef={searchRef}
            autoFocus
            placeholder="Buscar por nombre, SKU o escanear código…"
            onSelect={(p) => {
              const current = lines.find((l) => l.productId === p.id)?.quantity ?? 0
              if (p.stock_quantity <= current) {
                toast.error(`"${p.name}" no tiene más existencia disponible (${p.stock_quantity}).`)
                return
              }
              updateLines(addToCart(lines, { productId: p.id, name: p.name, sku: p.sku, unitPrice: Number(p.sale_price), stock: p.stock_quantity }))
              searchRef.current?.focus()
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="size-4" aria-hidden /> Carrito
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Busca y añade productos para comenzar.</p>
              ) : (
                <ul className="divide-y" aria-label="Artículos en el carrito">
                  {lines.map((l) => (
                    <li key={l.productId} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDOP(l.unitPrice)} c/u · {l.sku ?? 'Sin SKU'} · Existencia: {l.stock}
                        </p>
                      </div>
                      <div className="flex items-center gap-1" role="group" aria-label={`Cantidad de ${l.name}`}>
                        <Button variant="outline" size="icon" aria-label="Disminuir" onClick={() => updateLines(setLineQuantity(lines, l.productId, l.quantity - 1))}>
                          <Minus aria-hidden />
                        </Button>
                        <Input
                          aria-label={`Cantidad de ${l.name}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={l.stock}
                          step={1}
                          value={l.quantity}
                          onChange={(e) => {
                            const n = Math.floor(Number(e.target.value))
                            if (Number.isFinite(n) && n >= 1) updateLines(setLineQuantity(lines, l.productId, n))
                          }}
                          className={cn('w-16 text-center tabular-nums', l.quantity > l.stock && 'border-destructive')}
                        />
                        <Button variant="outline" size="icon" aria-label="Aumentar" disabled={l.quantity >= l.stock} onClick={() => updateLines(setLineQuantity(lines, l.productId, l.quantity + 1))}>
                          <Plus aria-hidden />
                        </Button>
                      </div>
                      <p className="w-28 text-right font-medium tabular-nums">{formatDOP(l.unitPrice * l.quantity)}</p>
                      <Button variant="ghost" size="icon" aria-label={`Quitar ${l.name}`} onClick={() => updateLines(removeLine(lines, l.productId))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Cobro</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right tabular-nums">{formatDOP(totals.subtotal)}</dd>
              <dt className="text-muted-foreground">Descuento</dt>
              <dd className="text-right tabular-nums">−{formatDOP(totals.discount)}</dd>
              <dt className="text-base font-semibold">Total</dt>
              <dd className="text-right text-2xl font-semibold tabular-nums">{formatDOP(totals.total)}</dd>
            </dl>

            <Field id="pos-discount" label="Descuento total (RD$)" hint="Opcional. No puede superar el subtotal.">
              <Input id="pos-discount" inputMode="decimal" placeholder="0.00" value={discountRaw} onChange={(e) => { setDiscountRaw(e.target.value); setErrors([]) }} />
            </Field>

            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Método de pago</legend>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <Button key={m} type="button" variant={method === m ? 'default' : 'outline'} aria-pressed={method === m} onClick={() => { setMethod(m); setErrors([]) }}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </Button>
                ))}
              </div>
            </fieldset>

            {method === 'cash' && (
              <>
                <Field id="pos-received" label="Importe recibido (RD$)" required>
                  <Input id="pos-received" inputMode="decimal" placeholder="0.00" value={receivedRaw} onChange={(e) => { setReceivedRaw(e.target.value); setErrors([]) }} />
                </Field>
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm">Cambio</span>
                  <span className="text-lg font-semibold tabular-nums">{formatDOP(totals.change)}</span>
                </div>
              </>
            )}

            <Field id="pos-note" label="Nota (opcional)">
              <Textarea id="pos-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            {errors.length > 0 && (
              <ul role="alert" className="grid gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <Button size="lg" className="h-12 text-base" disabled={createSale.isPending || lines.length === 0} onClick={confirm}>
              <CheckCircle2 aria-hidden /> {createSale.isPending ? 'Registrando venta…' : `Confirmar venta · ${formatDOP(totals.total)}`}
            </Button>
            {lines.length > 0 && (
              <Button variant="ghost" disabled={createSale.isPending} onClick={reset}>
                Vaciar carrito
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {completedSaleId && <SaleCompletedDialog saleId={completedSaleId} onClose={() => { setCompletedSaleId(null); searchRef.current?.focus() }} />}
    </>
  )
}

function SaleCompletedDialog({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const sale = useSale(saleId)
  const settings = useStoreSettings()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto print:max-h-none print:overflow-visible print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Venta registrada</DialogTitle>
          <DialogDescription>El inventario se actualizó. Puedes imprimir el recibo interno.</DialogDescription>
        </DialogHeader>
        {sale.data ? <Receipt sale={sale.data} storeName={settings.data?.store_name ?? 'CoplinTech'} /> : <LoadingState label="Cargando recibo…" />}
        <DialogFooter className="print:hidden">
          <Button variant="outline" asChild>
            <Link to={`/admin/ventas/${saleId}`}>Ver detalle</Link>
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!sale.data}>
            <Printer aria-hidden /> Imprimir
          </Button>
          <Button onClick={onClose}>Nueva venta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
