import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, CalendarDays, PackageX, Receipt, ShoppingBag, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { PageHeader } from '@/components/shared/PageHeader'
import { initialPeriodState, PeriodFilter, type PeriodState } from '@/components/shared/PeriodFilter'
import { EmptyState, ErrorState, LoadingState, QueryBoundary } from '@/components/shared/states'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRestockList } from '@/features/inventory/api'
import { fetchSummary, percentChange, usePaymentMethods, useProductPerformance, useSalesByDay, useSummary, useInventoryCounts } from '@/features/reports/api'
import { groupSalesSeries, PaymentMethodsChart, SalesBarChart } from '@/features/reports/charts'
import { formatDOP } from '@/lib/currency/format'
import { formatLocalDate, previousPeriod, resolvePeriod } from '@/lib/dates/santo-domingo'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodState>(() => initialPeriodState('thisMonth'))
  const p = period.period
  const prev = previousPeriod(p)

  // "Ventas del día" y "Ventas del mes" son fijos, independientes del filtro.
  const today = useSummary(resolvePeriod('today'), 'dashboard')
  const month = useSummary(resolvePeriod('thisMonth'), 'dashboard')
  const summary = useSummary(p, 'dashboard')
  const previous = useQuery({ queryKey: ['dashboard', 'summary-prev', prev], queryFn: () => fetchSummary(prev) })
  const byDay = useSalesByDay(p, 'dashboard')
  const products = useProductPerformance(p, 'dashboard')
  const methods = usePaymentMethods(p, 'dashboard')
  const inventory = useInventoryCounts()
  const restock = useRestockList()

  const change = summary.data && previous.data ? percentChange(summary.data.netSales, previous.data.netSales) : null

  return (
    <>
      <PageHeader title="Dashboard" description={`Período: ${formatLocalDate(p.start)} – ${formatLocalDate(p.end)} · Solo ventas completadas`} actions={<PeriodFilter value={period} onChange={setPeriod} />} />

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas del día" icon={CalendarDays} value={today.data ? formatDOP(today.data.netSales) : '…'} hint={today.data && `${today.data.salesCount} ventas`} />
        <StatCard label="Ventas del mes" icon={CalendarDays} value={month.data ? formatDOP(month.data.netSales) : '…'} hint={month.data && `${month.data.salesCount} ventas`} />
        <StatCard
          label="Ventas netas del período"
          icon={ShoppingBag}
          value={summary.data ? formatDOP(summary.data.netSales) : '…'}
          hint={<ChangeHint change={change} hasPrevious={Boolean(previous.data && previous.data.salesCount > 0)} />}
        />
        <StatCard label="Ganancia bruta" icon={TrendingUp} value={summary.data ? formatDOP(summary.data.grossProfit) : '…'} hint={summary.data && `Costo vendido: ${formatDOP(summary.data.costOfGoods)}`} />
        <StatCard label="Gastos del período" icon={Wallet} value={summary.data ? formatDOP(summary.data.expensesTotal) : '…'} />
        <StatCard
          label="Resultado operativo est."
          icon={Banknote}
          value={summary.data ? <span className={summary.data.operatingResult < 0 ? 'text-red-400' : undefined}>{formatDOP(summary.data.operatingResult)}</span> : '…'}
          hint="Ganancia bruta − gastos. Estimación interna, no contable."
        />
        <StatCard label="Ventas completadas" icon={Receipt} value={summary.data?.salesCount ?? '…'} hint={summary.data && `Ticket promedio: ${formatDOP(summary.data.averageTicket)}`} />
        <StatCard
          label="Inventario"
          icon={PackageX}
          value={inventory.data ? `${inventory.data.lowStock} / ${inventory.data.outOfStock}` : '…'}
          hint="Pocas unidades / agotados (productos activos)"
        />
      </section>
      {summary.isError && <div className="mt-4"><ErrorState error={summary.error} onRetry={() => void summary.refetch()} /></div>}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Ventas en el período</CardTitle>
            <CardDescription>Ventas netas y ganancia bruta {byDay.data && byDay.data.length > 45 ? 'por semana' : 'por día'}</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={byDay}>
              {byDay.data && byDay.data.every((d) => d.salesCount === 0) ? (
                <EmptyState title="Sin ventas en este período" />
              ) : (
                <SalesBarChart data={groupSalesSeries(byDay.data ?? [])} />
              )}
            </QueryBoundary>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Métodos de pago</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={methods}>{methods.data?.length ? <PaymentMethodsChart data={methods.data} /> : <EmptyState title="Sin ventas" />}</QueryBoundary>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Por unidades; importe neto después de descuentos.</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={products}>
              {products.data?.length === 0 ? (
                <EmptyState title="Sin ventas en este período" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.data?.slice(0, 8).map((r) => (
                      <TableRow key={r.productId ?? r.name}>
                        <TableCell className="max-w-56 truncate">{r.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDOP(r.netAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </QueryBoundary>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" aria-hidden /> Requieren reposición
              </CardTitle>
              <CardDescription>Productos activos con pocas unidades o agotados.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/inventario">Inventario</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {restock.isPending ? (
              <LoadingState />
            ) : restock.isError ? (
              <ErrorState error={restock.error} onRetry={() => void restock.refetch()} />
            ) : restock.data.length === 0 ? (
              <EmptyState title="Todo en orden" />
            ) : (
              <ul className="divide-y">
                {restock.data.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link to={`/admin/inventario?producto=${r.id}`} className="min-w-0 truncate hover:underline">
                      {r.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">{r.stock_quantity} u.</span>
                      <AvailabilityBadge value={r.availability} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ChangeHint({ change, hasPrevious }: { change: number | null; hasPrevious: boolean }) {
  if (!hasPrevious || change === null) return <span>Sin datos del período anterior para comparar</span>
  const up = change >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-1', up ? 'text-emerald-400' : 'text-red-400')}>
      <Icon className="size-3" aria-hidden />
      {up ? '+' : ''}
      {change.toFixed(1)}% vs. período anterior
    </span>
  )
}
