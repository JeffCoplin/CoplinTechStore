import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDOP } from '@/lib/currency/format'
import { formatShortDay } from '@/lib/dates/santo-domingo'
import { paymentMethodLabel } from '@/lib/domain/payments'

const AXIS = { stroke: 'var(--muted-foreground)', fontSize: 12 }
const TOOLTIP_STYLE = { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }
export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const compact = new Intl.NumberFormat('es-DO', { notation: 'compact', maximumFractionDigits: 1 })

export interface SalesPoint {
  label: string
  netSales: number
  grossProfit: number
}

/** Agrupa por semana (desde el primer día) cuando el período es largo. */
export function groupSalesSeries(days: { day: string; netSales: number; grossProfit: number }[]): SalesPoint[] {
  if (days.length <= 45) return days.map((d) => ({ label: formatShortDay(d.day), netSales: d.netSales, grossProfit: d.grossProfit }))
  const weeks: SalesPoint[] = []
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7)
    weeks.push({
      label: `Sem. ${formatShortDay(chunk[0]!.day)}`,
      netSales: chunk.reduce((a, d) => a + d.netSales, 0),
      grossProfit: chunk.reduce((a, d) => a + d.grossProfit, 0),
    })
  }
  return weeks
}

export function SalesBarChart({ data }: { data: SalesPoint[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Gráfico de ventas netas y ganancia bruta por período">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compact.format(v)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} formatter={(v) => formatDOP(Number(v))} />
          <Bar dataKey="netSales" name="Ventas netas" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="grossProfit" name="Ganancia bruta" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PaymentMethodsChart({ data }: { data: { method: string; netSales: number; count: number }[] }) {
  const total = data.reduce((a, d) => a + d.netSales, 0)
  return (
    <div className="grid items-center gap-4 sm:grid-cols-2">
      <div className="h-48" role="img" aria-label="Distribución de ventas por método de pago">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="netSales" nameKey="method" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.method} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [formatDOP(Number(v)), paymentMethodLabel(String(name))]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-2 text-sm">
        {data.map((d, i) => (
          <li key={d.method} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden />
              {paymentMethodLabel(d.method)} <span className="text-xs text-muted-foreground">({d.count})</span>
            </span>
            <span className="tabular-nums">
              {formatDOP(d.netSales)} <span className="text-xs text-muted-foreground">{total ? Math.round((d.netSales / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
