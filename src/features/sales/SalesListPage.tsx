import { Download, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { initialPeriodState, PeriodFilter, type PeriodState } from '@/components/shared/PeriodFilter'
import { EmptyState, QueryBoundary } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDOP } from '@/lib/currency/format'
import { formatDateTime } from '@/lib/dates/santo-domingo'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, paymentMethodLabel, SALE_STATUS_LABELS, type PaymentMethod } from '@/lib/domain/payments'
import { toUserMessage } from '@/lib/supabase/errors'
import { downloadCsv } from '@/lib/utils/csv'
import { buildSalesQuery, useSales, type SalesFilters } from './api'

export default function SalesListPage() {
  const [period, setPeriod] = useState<PeriodState>(() => initialPeriodState('thisMonth'))
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SalesFilters['status']>('all')
  const [method, setMethod] = useState<SalesFilters['method']>('all')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const filters = { search, period: period.period, status, method }
  const sales = useSales({ ...filters, page })

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchDraft)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchDraft])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const { data, error } = await buildSalesQuery(filters).range(0, 9999)
      if (error) throw error
      downloadCsv(
        `ventas_${period.period.start}_${period.period.end}.csv`,
        ['Número', 'Fecha', 'Estado', 'Método de pago', 'Subtotal', 'Descuento', 'Total'],
        data.map((s) => [s.sale_number, formatDateTime(s.created_at), SALE_STATUS_LABELS[s.status], paymentMethodLabel(s.payment_method), s.subtotal, s.discount_amount, s.total]),
      )
    } catch (e) {
      toast.error(toUserMessage(e, 'No se pudo exportar.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Historial de ventas físicas. Las anuladas se conservan y se excluyen de los reportes."
        actions={
          <>
            <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting || !sales.data?.total}>
              <Download aria-hidden /> {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Button>
            <Button asChild>
              <Link to="/admin/ventas/nueva">
                <Plus aria-hidden /> Nueva venta
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <PeriodFilter value={period} onChange={(v) => { setPeriod(v); setPage(0) }} />
        <div className="grid gap-1.5">
          <Label htmlFor="sale-search">Número de venta</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="sale-search" type="search" className="w-44 pl-9" placeholder="CP-000123" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sale-status">Estado</Label>
          <NativeSelect id="sale-status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value as SalesFilters['status']); setPage(0) }}>
            <option value="all">Todos</option>
            <option value="completed">Completadas</option>
            <option value="voided">Anuladas</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sale-method">Método</Label>
          <NativeSelect id="sale-method" className="w-40" value={method} onChange={(e) => { setMethod(e.target.value as SalesFilters['method']); setPage(0) }}>
            <option value="all">Todos</option>
            {PAYMENT_METHODS.map((m: PaymentMethod) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <QueryBoundary query={sales} loadingLabel="Cargando ventas…">
        {sales.data?.rows.length === 0 ? (
          <EmptyState title="No hay ventas con estos filtros" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.data?.rows.map((s) => (
                    <TableRow key={s.id} className={s.status === 'voided' ? 'text-muted-foreground' : undefined}>
                      <TableCell>
                        <Link to={`/admin/ventas/${s.id}`} className="font-mono font-medium hover:underline">
                          {s.sale_number}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(s.created_at)}</TableCell>
                      <TableCell>{paymentMethodLabel(s.payment_method)}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'voided' ? 'destructive' : 'secondary'}>{SALE_STATUS_LABELS[s.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDOP(s.discount_amount)}</TableCell>
                      <TableCell className={s.status === 'voided' ? 'text-right tabular-nums line-through' : 'text-right font-medium tabular-nums'}>{formatDOP(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} total={sales.data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </QueryBoundary>
    </>
  )
}
