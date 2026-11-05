export type ManualMovementType = 'restock' | 'adjustment'

export interface MovementInput {
  type: ManualMovementType
  delta: number
  reason: string
}

/**
 * Validación previa de una entrada o ajuste. La función record_stock_movement
 * repite estas reglas y además impide existencias negativas con bloqueo de fila.
 */
export function validateMovement(input: MovementInput, currentStock: number): string | null {
  if (!Number.isInteger(input.delta) || input.delta === 0) return 'La cantidad debe ser un entero distinto de cero.'
  if (input.type === 'restock' && input.delta < 0) return 'Una entrada debe ser positiva.'
  if (input.type === 'adjustment' && input.reason.trim() === '') return 'El ajuste requiere un motivo.'
  if (currentStock + input.delta < 0) return `La operación dejaría la existencia en negativo (actual: ${currentStock}).`
  return null
}
