import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field, fieldA11y } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { QueryBoundary } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toUserMessage } from '@/lib/supabase/errors'
import { isValidWhatsappNumber, normalizeWhatsappNumber } from '@/lib/utils/whatsapp'
import { useStoreSettings, useUpdateStoreSettings } from './api'

const settingsSchema = z.object({
  store_name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
  whatsapp_number: z
    .string()
    .transform(normalizeWhatsappNumber)
    .refine((v) => v === '' || isValidWhatsappNumber(v), 'Usa formato internacional sin espacios: código de país + número (8 a 15 dígitos).')
    .transform((v) => (v === '' ? null : v)),
  default_low_stock_threshold: z.number({ error: 'Introduce un número.' }).int('Debe ser entero.').min(0).max(1_000_000),
})
type Input_ = z.input<typeof settingsSchema>
type Output = z.output<typeof settingsSchema>

export default function SettingsPage() {
  const settings = useStoreSettings()
  return (
    <>
      <PageHeader title="Configuración" description="Datos de la tienda. Moneda y zona horaria son fijas en esta versión." />
      <QueryBoundary query={settings}>{settings.data && <SettingsForm initial={settings.data} />}</QueryBoundary>
    </>
  )
}

function SettingsForm({ initial }: { initial: NonNullable<ReturnType<typeof useStoreSettings>['data']> }) {
  const update = useUpdateStoreSettings()
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      store_name: initial.store_name,
      whatsapp_number: initial.whatsapp_number ?? '',
      default_low_stock_threshold: initial.default_low_stock_threshold,
    },
  })
  const { errors, isDirty } = form.formState

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        update.mutate(values, {
          onSuccess: () => {
            toast.success('Configuración guardada')
            form.reset({ ...values, whatsapp_number: values.whatsapp_number ?? '' })
          },
          onError: (e) => toast.error(toUserMessage(e)),
        }),
      )}
      className="grid max-w-2xl gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Tienda</CardTitle>
          <CardDescription>El nombre aparece en el catálogo y en los recibos internos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field id="st-name" label="Nombre de la tienda" required error={errors.store_name?.message}>
            <Input {...fieldA11y('st-name', errors.store_name?.message)} {...form.register('store_name')} />
          </Field>
          <Field
            id="st-whatsapp"
            label="Número de WhatsApp"
            error={errors.whatsapp_number?.message}
            hint="Formato internacional sin «+», p. ej. código de país seguido del número. Déjalo vacío para ocultar el botón en el catálogo."
          >
            <Input inputMode="tel" placeholder="Sin configurar" {...fieldA11y('st-whatsapp', errors.whatsapp_number?.message, 'hint')} {...form.register('whatsapp_number')} />
          </Field>
          <Field id="st-threshold" label="Umbral predeterminado de pocas unidades" error={errors.default_low_stock_threshold?.message} hint="Valor inicial para productos nuevos; cada producto puede tener el suyo.">
            <Input type="number" min={0} step={1} {...fieldA11y('st-threshold', errors.default_low_stock_threshold?.message, 'hint')} {...form.register('default_low_stock_threshold', { valueAsNumber: true })} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Regional</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            Moneda: <span className="font-medium">{initial.currency_code} (RD$)</span>
          </p>
          <p>
            Zona horaria: <span className="font-medium">{initial.timezone}</span>
          </p>
        </CardContent>
      </Card>
      <Button type="submit" className="justify-self-start" disabled={!isDirty || update.isPending}>
        {update.isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
