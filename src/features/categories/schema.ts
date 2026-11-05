import { z } from 'zod'
import { SLUG_PATTERN } from '@/lib/utils/slug'

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(80, 'Máximo 80 caracteres.'),
  slug: z.string().trim().regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones (ej. audio-y-sonido).').max(80),
  sort_order: z.number({ error: 'Introduce un número.' }).int('Debe ser un número entero.').min(0).max(9999),
  is_active: z.boolean(),
})

export type CategoryValues = z.infer<typeof categorySchema>
