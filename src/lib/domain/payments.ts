export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  card: 'Tarjeta',
}

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return PAYMENT_METHOD_LABELS[value as PaymentMethod] ?? value
}

export const SALE_STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  voided: 'Anulada',
}

export const EXPENSE_CATEGORIES = [
  'advertising',
  'transport',
  'packaging',
  'services',
  'rent',
  'supplies',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  advertising: 'Publicidad',
  transport: 'Transporte',
  packaging: 'Embalaje',
  services: 'Servicios',
  rent: 'Alquiler',
  supplies: 'Suministros',
  other: 'Otros',
}

export function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORY_LABELS[value as ExpenseCategory] ?? value
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  initial_stock: 'Existencia inicial',
  restock: 'Entrada',
  adjustment: 'Ajuste',
  sale: 'Venta',
  void_sale: 'Anulación de venta',
}
