import { Download } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { initialPeriodState, PeriodFilter, type PeriodState } from '@/components/shared/PeriodFilter'
import { EmptyState, QueryBoundary } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDOP } from '@/lib/currency/format'
import { formatLocalDate } from '@/lib/dates/santo-domingo'
import { expenseCategoryLabel, paymentMethodLabel } from '@/lib/domain/payments'
import { downloadCsv } from '@/lib/utils/csv'
import { useExpensesByCategory, usePaymentMethods, useProductPerformance, useSalesByDay, useSummary } from './api'
import { groupSalesSeries, PaymentMethodsChart, SalesBarChart } from './charts'

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodState>(() => initialPeriodState('thisMonth'))
  const p = period.period
  const suffix = `${p.start}_${p.end}`
  const summary = useSummary(p)
  const byDay = useSalesByDay(p)
  const products = useProductPerformance(p)
  const methods = usePaymentMethods(p)
  const expenses = useExpensesByCategory(p)

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`${formatLocalDate(p.start)} – ${formatLocalDate(p.end)} · Excluye ventas y gastos anulados. Resultados estimados de uso interno; no constituyen estados financieros ni información fiscal.`}
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <QueryBoundary query={summary}>
        {summary.data && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Resumen del período</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ['Ventas brutas', formatDOP(summary.data.grossSales)],
                  ['Descuentos', formatDOP(summary.data.discountTotal)],
                  ['Ventas netas', formatDOP(summary.data.netSales)],
                  ['Costo vendido', formatDOP(summary.data.costOfGoods)],
                  ['Ganancia bruta', formatDOP(summary.data.grossProfit)],
                  ['Gastos', formatDOP(summary.data.expensesTotal)],
                  ['Resultado operativo est.', formatDOP(summary.data.operatingResult)],
                  ['Ventas completadas', String(summary.data.salesCount)],
                  ['Ticket promedio', formatDOP(summary.data.averageTicket)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-base font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      <Tabs defaultValue="ventas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ventas">Ventas por período</TabsTrigger>
          <TabsTrigger value="productos">Ganancia por producto</TabsTrigger>
          <TabsTrigger value="gastos">Gastos por categoría</TabsTrigger>
          <TabsTrigger value="metodos">Métodos de pago</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="mt-4">
          <ReportCard
            title="Ventas por día"
            onExport={
              byDay.data &&
              (() =>
                downloadCsv(`ventas_por_dia_${suffix}.csv`, ['Fecha', 'Ventas completadas', 'Ventas netas', 'Ganancia bruta'], byDay.data!.map((d) => [d.day, d.salesCount, d.netSales.toFixed(2), d.grossProfit.toFixed(2)])))
            }
          >
            <QueryBoundary query={byDay}>
              {byDay.data && (
                <>
                  <SalesBarChart data={groupSalesSeries(byDay.data)} />
                  <div className="mt-4 max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Ventas</TableHead>
                          <TableHead className="text-right">Ventas netas</TableHead>
                          <TableHead className="text-right">Ganancia bruta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byDay.data.filter((d) => d.salesCount > 0).map((d) => (
                          <TableRow key={d.day}>
                            <TableCell>{formatLocalDate(d.day)}</TableCell>
                            <TableCell className="text-right tabular-nums">{d.salesCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatDOP(d.netSales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatDOP(d.grossProfit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </QueryBoundary>
          </ReportCard>
        </TabsContent>

        <TabsContent value="productos" className="mt-4">
          <ReportCard
            title="Ganancia bruta por producto"
            description="El descuento de cada venta se prorratea entre sus líneas."
            onExport={
              products.data?.length
                ? () =>
                    downloadCsv(
                      `ganancia_por_producto_${suffix}.csv`,
                      ['Producto', 'SKU', 'Unidades', 'Ventas netas', 'Costo', 'Ganancia bruta'],
                      products.data!.map((r) => [r.name, r.sku, r.units, r.netAmount.toFixed(2), r.costAmount.toFixed(2), r.grossProfit.toFixed(2)]),
                    )
                : undefined
            }
          >
            <QueryBoundary query={products}>
              {products.data?.length === 0 ? (
                <EmptyState title="Sin ventas en este período" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Ventas netas</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Ganancia</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.data?.map((r) => (
                        <TableRow key={r.productId ?? r.name}>
                          <TableCell>
                            {r.name}
                            <span className="block text-xs text-muted-foreground">{r.sku ?? 'Sin SKU'}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatDOP(r.netAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatDOP(r.costAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatDOP(r.grossProfit)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.netAmount ? `${((r.grossProfit / r.netAmount) * 100).toFixed(1)}%` : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </QueryBoundary>
          </ReportCard>
        </TabsContent>

        <TabsContent value="gastos" className="mt-4">
          <ReportCard
            title="Gastos por categoría"
            onExport={
              expenses.data?.length
                ? () => downloadCsv(`gastos_por_categoria_${suffix}.csv`, ['Categoría', 'Cantidad', 'Total'], expenses.data!.map((e) => [expenseCategoryLabel(e.category), e.count, e.total.toFixed(2)]))
                : undefined
            }
          >
            <QueryBoundary query={expenses}>
              {expenses.data?.length === 0 ? (
                <EmptyState title="Sin gastos en este período" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Registros</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.data?.map((e) => (
                      <TableRow key={e.category}>
                        <TableCell>{expenseCategoryLabel(e.category)}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDOP(e.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">{expenses.data?.reduce((a, e) => a + e.count, 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDOP(expenses.data?.reduce((a, e) => a + e.total, 0))}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </QueryBoundary>
          </ReportCard>
        </TabsContent>

        <TabsContent value="metodos" className="mt-4">
          <ReportCard
            title="Métodos de pago"
            onExport={
              methods.data?.length
                ? () => downloadCsv(`metodos_de_pago_${suffix}.csv`, ['Método', 'Ventas', 'Ventas netas'], methods.data!.map((m) => [paymentMethodLabel(m.method), m.count, m.netSales.toFixed(2)]))
                : undefined
            }
          >
            <QueryBoundary query={methods}>{methods.data?.length ? <PaymentMethodsChart data={methods.data} /> : <EmptyState title="Sin ventas en este período" />}</QueryBoundary>
          </ReportCard>
        </TabsContent>
      </Tabs>
    </>
  )
}

function ReportCard({ title, description, onExport, children }: { title: string; description?: string; onExport?: (() => void) | null; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <Button variant="outline" size="sm" disabled={!onExport} onClick={() => onExport?.()}>
          <Download aria-hidden /> CSV
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
