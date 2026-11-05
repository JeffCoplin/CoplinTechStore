import { z } from 'zod'
import { isValidIsoDate } from '@/lib/dates/santo-domingo'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/domain/payments'

export const expenseSchema = z.object({
  expense_date: z.string().refine(isValidIsoDate, 'Fecha inválida.'),
  category: z.enum(EXPENSE_CATEGORIES, { error: 'Selecciona una categoría.' }),
  description: z.string().trim().min(1, 'La descripción es obligatoria.').max(200, 'Máximo 200 caracteres.'),
  amount: z
    .number({ error: 'Introduce un importe válido.' })
    .finite()
    .gt(0, 'El importe debe ser mayor que cero.')
    .max(9_999_999_999.99, 'Importe demasiado grande.')
    .refine((v) => Number(v.toFixed(2)) === v, 'Máximo 2 decimales.'),
  payment_method: z
    .union([z.enum(PAYMENT_METHODS), z.literal('')])
    .transform((v) => (v === '' ? null : v)),
  note: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres.')
    .transform((v) => (v === '' ? null : v)),
})

export type ExpenseFormInput = z.input<typeof expenseSchema>
export type ExpenseValues = z.output<typeof expenseSchema>
