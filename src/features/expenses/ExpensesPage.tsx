import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, Download, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Field, fieldA11y } from '@/components/shared/Field'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Pagination } from '@/components/shared/Pagination'
import { initialPeriodState, PeriodFilter, type PeriodState } from '@/components/shared/PeriodFilter'
import { EmptyState, QueryBoundary } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatDOP } from '@/lib/currency/format'
import { formatLocalDate, toLocalDateString } from '@/lib/dates/santo-domingo'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, expenseCategoryLabel, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, paymentMethodLabel } from '@/lib/domain/payments'
import { toUserMessage } from '@/lib/supabase/errors'
import { downloadCsv } from '@/lib/utils/csv'
import type { Tables } from '@/types/database.types'
import { buildExpensesQuery, useExpenses, useSaveExpense, useVoidExpense } from './api'
import { expenseSchema, type ExpenseFormInput, type ExpenseValues } from './schema'

type Expense = Pick<Tables<'expenses'>, 'id' | 'expense_date' | 'category' | 'description' | 'amount' | 'payment_method' | 'note' | 'is_voided'>

export default function ExpensesPage() {
  const [period, setPeriod] = useState<PeriodState>(() => initialPeriodState('thisMonth'))
  const [category, setCategory] = useState('all')
  const [includeVoided, setIncludeVoided] = useState(false)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [voiding, setVoiding] = useState<Expense | null>(null)
  const filters = { period: period.period, category, includeVoided }
  const expenses = useExpenses({ ...filters, page })
  const voidExpense = useVoidExpense()

  const exportCsv = async () => {
    const { data, error } = await buildExpensesQuery(filters).range(0, 9999)
    if (error) return toast.error(toUserMessage(error))
    downloadCsv(
      `gastos_${period.period.start}_${period.period.end}.csv`,
      ['Fecha', 'Categoría', 'Descripción', 'Importe', 'Método de pago', 'Nota', 'Estado'],
      data.map((e) => [e.expense_date, expenseCategoryLabel(e.category), e.description, e.amount, paymentMethodLabel(e.payment_method), e.note, e.is_voided ? 'Anulado' : 'Vigente']),
    )
  }

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Los gastos vigentes del período se restan en el resultado operativo estimado."
        actions={
          <>
            <Button variant="outline" onClick={() => void exportCsv()} disabled={!expenses.data?.total}>
              <Download aria-hidden /> Exportar CSV
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden /> Nuevo gasto
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <PeriodFilter value={period} onChange={(v) => { setPeriod(v); setPage(0) }} />
        <div className="grid gap-1.5">
          <Label htmlFor="exp-filter-cat">Categoría</Label>
          <NativeSelect id="exp-filter-cat" className="w-44" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0) }}>
            <option value="all">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Checkbox checked={includeVoided} onCheckedChange={(v) => { setIncludeVoided(v === true); setPage(0) }} />
          Mostrar anulados
        </label>
      </div>

      <QueryBoundary query={expenses} loadingLabel="Cargando gastos…">
        {expenses.data?.rows.length === 0 ? (
          <EmptyState title="No hay gastos en este período" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="hidden md:table-cell">Método</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.data?.rows.map((e) => (
                    <TableRow key={e.id} className={e.is_voided ? 'text-muted-foreground' : undefined}>
                      <TableCell className="whitespace-nowrap">{formatLocalDate(e.expense_date)}</TableCell>
                      <TableCell>{expenseCategoryLabel(e.category)}</TableCell>
                      <TableCell>
                        {e.description}
                        {e.is_voided && (
                          <Badge variant="destructive" className="ml-2">
                            Anulado
                          </Badge>
                        )}
                        {e.note && <span className="block text-xs text-muted-foreground">{e.note}</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{paymentMethodLabel(e.payment_method)}</TableCell>
                      <TableCell className={e.is_voided ? 'text-right tabular-nums line-through' : 'text-right tabular-nums'}>{formatDOP(e.amount)}</TableCell>
                      <TableCell className="text-right">
                        {!e.is_voided && (
                          <>
                            <Button variant="ghost" size="icon" aria-label={`Editar gasto ${e.description}`} onClick={() => setEditing(e)}>
                              <Pencil aria-hidden />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`Anular gasto ${e.description}`} onClick={() => setVoiding(e)}>
                              <Ban aria-hidden />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} total={expenses.data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </QueryBoundary>

      {editing && <ExpenseDialog expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(voiding)}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Anular gasto"
        description={`"${voiding?.description}" (${formatDOP(voiding?.amount)}) dejará de contar en los reportes. Se conserva en el historial y no podrá editarse.`}
        confirmLabel="Anular gasto"
        destructive
        pending={voidExpense.isPending}
        onConfirm={() =>
          voiding &&
          voidExpense.mutate(voiding.id, {
            onSuccess: () => {
              toast.success('Gasto anulado')
              setVoiding(null)
            },
            onError: (e) => toast.error(toUserMessage(e)),
          })
        }
      />
    </>
  )
}

function ExpenseDialog({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const save = useSaveExpense()
  const form = useForm<ExpenseFormInput, unknown, ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_date: expense?.expense_date ?? toLocalDateString(),
      category: (expense?.category as ExpenseFormInput['category']) ?? 'other',
      description: expense?.description ?? '',
      amount: expense ? Number(expense.amount) : (undefined as unknown as number),
      payment_method: (expense?.payment_method as ExpenseFormInput['payment_method']) ?? '',
      note: expense?.note ?? '',
    },
  })
  const { errors } = form.formState
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: expense?.id, values },
      {
        onSuccess: () => {
          toast.success(expense ? 'Gasto actualizado' : 'Gasto registrado')
          onClose()
        },
        onError: (e) => toast.error(toUserMessage(e)),
      },
    ),
  )

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          <DialogDescription>Importe en pesos dominicanos (RD$).</DialogDescription>
        </DialogHeader>
        <form id="expense-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field id="exp-date" label="Fecha" required error={errors.expense_date?.message}>
            <Input type="date" {...fieldA11y('exp-date', errors.expense_date?.message)} {...form.register('expense_date')} />
          </Field>
          <Field id="exp-cat" label="Categoría" required error={errors.category?.message}>
            <NativeSelect {...fieldA11y('exp-cat', errors.category?.message)} {...form.register('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="exp-desc" label="Descripción" required error={errors.description?.message} className="sm:col-span-2">
            <Input {...fieldA11y('exp-desc', errors.description?.message)} {...form.register('description')} />
          </Field>
          <Field id="exp-amount" label="Importe (RD$)" required error={errors.amount?.message}>
            <Input type="number" inputMode="decimal" min={0.01} step="0.01" {...fieldA11y('exp-amount', errors.amount?.message)} {...form.register('amount', { valueAsNumber: true })} />
          </Field>
          <Field id="exp-method" label="Método de pago" error={errors.payment_method?.message}>
            <NativeSelect {...fieldA11y('exp-method', errors.payment_method?.message)} {...form.register('payment_method')}>
              <option value="">No especificado</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="exp-note" label="Nota" error={errors.note?.message} className="sm:col-span-2">
            <Textarea rows={2} {...fieldA11y('exp-note', errors.note?.message)} {...form.register('note')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="expense-form" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
