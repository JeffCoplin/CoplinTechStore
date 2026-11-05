import { formatDOP } from '@/lib/currency/format'
import { formatDateTime } from '@/lib/dates/santo-domingo'
import { paymentMethodLabel } from '@/lib/domain/payments'
import type { SaleDetail } from './api'

/** Recibo interno imprimible. No es comprobante fiscal (sin NCF). */
export function Receipt({ sale, storeName }: { sale: SaleDetail; storeName: string }) {
  return (
    <div id="receipt" className="mx-auto w-full max-w-sm rounded-lg border bg-card p-5 font-mono text-sm print:max-w-none print:border-0 print:p-0">
      <div className="text-center">
        <p className="text-base font-bold">{storeName}</p>
        <p className="text-xs">Recibo interno</p>
        <p className="mt-2 text-xs">{sale.sale_number}</p>
        <p className="text-xs">{formatDateTime(sale.created_at)}</p>
        {sale.status === 'voided' && <p className="mt-2 border border-current py-1 text-xs font-bold">VENTA ANULADA</p>}
      </div>
      <hr className="my-3 border-dashed" />
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left">
            <th className="pb-1 font-semibold">Artículo</th>
            <th className="pb-1 text-right font-semibold">Cant.</th>
            <th className="pb-1 text-right font-semibold">Importe</th>
          </tr>
        </thead>
        <tbody>
          {sale.sale_items.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="py-0.5 pr-2">
                {i.product_name_snapshot}
                <span className="block text-[10px] opacity-70">{formatDOP(i.unit_sale_price)} c/u</span>
              </td>
              <td className="py-0.5 text-right">{i.quantity}</td>
              <td className="py-0.5 text-right">{formatDOP(i.line_subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-3 border-dashed" />
      <dl className="grid grid-cols-2 gap-y-0.5 text-xs">
        <dt>Subtotal</dt>
        <dd className="text-right">{formatDOP(sale.subtotal)}</dd>
        <dt>Descuento</dt>
        <dd className="text-right">−{formatDOP(sale.discount_amount)}</dd>
        <dt className="text-sm font-bold">Total</dt>
        <dd className="text-right text-sm font-bold">{formatDOP(sale.total)}</dd>
        <dt>Método de pago</dt>
        <dd className="text-right">{paymentMethodLabel(sale.payment_method)}</dd>
        {sale.payment_method === 'cash' && (
          <>
            <dt>Recibido</dt>
            <dd className="text-right">{formatDOP(sale.amount_received)}</dd>
            <dt>Cambio</dt>
            <dd className="text-right">{formatDOP(sale.change_amount)}</dd>
          </>
        )}
      </dl>
      <hr className="my-3 border-dashed" />
      <p className="text-center text-[10px] leading-snug">
        Documento interno de {storeName}. No es una factura ni comprobante fiscal (NCF).
      </p>
    </div>
  )
}
