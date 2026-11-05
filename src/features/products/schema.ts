import { z } from 'zod'
import { SLUG_PATTERN } from '@/lib/utils/slug'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))

const money = (msg: string) =>
  z
    .number({ error: 'Introduce un importe válido.' })
    .finite()
    .refine((v) => Math.round(v * 100) / 100 === Number(v.toFixed(2)), 'Máximo 2 decimales.')
    .refine((v) => v <= 9_999_999_999.99, 'Importe demasiado grande.')
    .pipe(z.number().min(0, msg))

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio.').max(160, 'Máximo 160 caracteres.'),
    slug: z.string().trim().max(80).regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones.'),
    sku: optionalText(64),
    barcode: optionalText(64),
    brand: optionalText(80),
    category_id: z.string().transform((v) => (v === '' ? null : v)),
    description: optionalText(5000),
    cost_price: money('El costo debe ser mayor o igual a cero.'),
    sale_price: money('El precio de venta debe ser mayor que cero.').refine((v) => v > 0, 'El precio de venta debe ser mayor que cero.'),
    stock_quantity: z.number({ error: 'Introduce un número.' }).int('Debe ser un número entero.').min(0, 'No puede ser negativa.').max(1_000_000),
    low_stock_threshold: z.number({ error: 'Introduce un número.' }).int('Debe ser un número entero.').min(0, 'No puede ser negativo.').max(1_000_000),
    is_active: z.boolean(),
    is_published: z.boolean(),
  })

export type ProductFormInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** Límite del bucket (también validado por Storage). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Tamaño máximo aceptado antes de optimizar en el navegador (fotos de teléfono). */
export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024

/** Validación del archivo elegido, antes de optimizarlo. */
export function validateImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Formato no permitido. Usa JPG, PNG o WebP.'
  if (file.size > MAX_SOURCE_IMAGE_BYTES) return 'La imagen supera 20 MB.'
  return null
}

/** Validación del archivo final que se sube a Storage. */
export function validateUploadImage(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Formato no permitido. Usa JPG, PNG o WebP.'
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen sigue superando 5 MB tras optimizarla.'
  return null
}
