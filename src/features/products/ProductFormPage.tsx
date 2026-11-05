import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Boxes, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { Field, fieldA11y } from '@/components/shared/Field'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCategories } from '@/features/categories/api'
import { useStoreSettings } from '@/features/settings/api'
import { formatDOP } from '@/lib/currency/format'
import { availabilityFor } from '@/lib/domain/availability'
import { productImageUrl } from '@/lib/supabase/client'
import { toUserMessage } from '@/lib/supabase/errors'
import { slugify } from '@/lib/utils/slug'
import { useProduct, useSaveProduct } from './api'
import { compressProductImage } from './compress-image'
import { productSchema, validateImageFile, validateUploadImage, type ProductFormInput, type ProductValues } from './schema'

export default function ProductFormPage() {
  const { id } = useParams()
  const isNew = !id
  const product = useProduct(id)
  const settings = useStoreSettings()

  if (!isNew && product.isPending) return <LoadingState label="Cargando producto…" />
  if (!isNew && product.isError) return <ErrorState error={product.error} onRetry={() => void product.refetch()} />
  if (!isNew && !product.data)
    return <EmptyState title="Producto no encontrado" action={<Button asChild variant="outline"><Link to="/admin/productos">Volver</Link></Button>} />
  if (isNew && settings.isPending) return <LoadingState />

  return <ProductForm key={id ?? 'new'} product={product.data ?? null} defaultThreshold={settings.data?.default_low_stock_threshold ?? 2} />
}

type ProductRow = NonNullable<ReturnType<typeof useProduct>['data']>

function ProductForm({ product, defaultThreshold }: { product: ProductRow | null; defaultThreshold: number }) {
  const navigate = useNavigate()
  const categories = useCategories()
  const save = useSaveProduct()
  const [newImage, setNewImage] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  const form = useForm<ProductFormInput, unknown, ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      brand: product?.brand ?? '',
      category_id: product?.category_id ?? '',
      description: product?.description ?? '',
      cost_price: product ? Number(product.cost_price) : (undefined as unknown as number),
      sale_price: product ? Number(product.sale_price) : (undefined as unknown as number),
      stock_quantity: product?.stock_quantity ?? 0,
      low_stock_threshold: product?.low_stock_threshold ?? defaultThreshold,
      is_active: product?.is_active ?? true,
      is_published: product?.is_published ?? false,
    },
  })
  const { errors, isDirty } = form.formState

  const previewUrl = useMemo(() => (newImage ? URL.createObjectURL(newImage) : null), [newImage])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])
  const currentImage = previewUrl ?? (removeImage ? null : productImageUrl(product?.image_path))

  const cost = form.watch('cost_price')
  const price = form.watch('sale_price')
  const margin = Number.isFinite(cost) && Number.isFinite(price) && price > 0 ? price - cost : null

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: product?.id, values, newImage, removeImage, previousImagePath: product?.image_path ?? null },
      {
        onSuccess: (savedId) => {
          toast.success(product ? 'Producto actualizado' : 'Producto creado')
          if (product) {
            setNewImage(null)
            setRemoveImage(false)
            form.reset(form.getValues())
          } else navigate(`/admin/productos/${savedId}`, { replace: true })
        },
        onError: (e) => toast.error(toUserMessage(e)),
      },
    ),
  )

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/admin/productos">
          <ArrowLeft aria-hidden /> Productos
        </Link>
      </Button>
      <PageHeader title={product ? `Editar: ${product.name}` : 'Nuevo producto'} />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="p-name" label="Nombre" required error={errors.name?.message} className="sm:col-span-2">
                <Input
                  {...fieldA11y('p-name', errors.name?.message)}
                  {...form.register('name', {
                    onChange: (e) => {
                      if (!product && !form.formState.dirtyFields.slug) form.setValue('slug', slugify(e.target.value))
                    },
                  })}
                />
              </Field>
              <Field id="p-slug" label="Slug (dirección pública)" required error={errors.slug?.message} hint="/catalogo/tu-slug">
                <Input {...fieldA11y('p-slug', errors.slug?.message, '/catalogo/tu-slug')} {...form.register('slug')} />
              </Field>
              <Field id="p-brand" label="Marca" error={errors.brand?.message}>
                <Input {...fieldA11y('p-brand', errors.brand?.message)} {...form.register('brand')} />
              </Field>
              <Field id="p-sku" label="SKU" error={errors.sku?.message} hint="Opcional, único.">
                <Input {...fieldA11y('p-sku', errors.sku?.message, 'Opcional, único.')} {...form.register('sku')} />
              </Field>
              <Field id="p-barcode" label="Código de barras" error={errors.barcode?.message} hint="Opcional, único.">
                <Input {...fieldA11y('p-barcode', errors.barcode?.message, 'Opcional, único.')} {...form.register('barcode')} />
              </Field>
              <Field id="p-category" label="Categoría" error={errors.category_id?.message} className="sm:col-span-2">
                <NativeSelect {...fieldA11y('p-category', errors.category_id?.message)} {...form.register('category_id')}>
                  <option value="">Sin categoría</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_active ? '' : ' (inactiva)'}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="p-description" label="Descripción" error={errors.description?.message} className="sm:col-span-2">
                <Textarea rows={5} {...fieldA11y('p-description', errors.description?.message)} {...form.register('description')} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios e inventario</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="p-cost" label="Precio de costo (RD$)" required error={errors.cost_price?.message} hint="Privado: nunca se muestra en el catálogo.">
                <Input type="number" inputMode="decimal" min={0} step="0.01" {...fieldA11y('p-cost', errors.cost_price?.message, 'Privado: nunca se muestra en el catálogo.')} {...form.register('cost_price', { valueAsNumber: true })} />
              </Field>
              <Field id="p-price" label="Precio de venta (RD$)" required error={errors.sale_price?.message}>
                <Input type="number" inputMode="decimal" min={0.01} step="0.01" {...fieldA11y('p-price', errors.sale_price?.message)} {...form.register('sale_price', { valueAsNumber: true })} />
              </Field>
              {margin !== null && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Margen unitario: <span className={margin < 0 ? 'text-destructive' : 'text-foreground'}>{formatDOP(margin)}</span>
                  {margin < 0 && ' (el precio es menor que el costo)'}
                </p>
              )}
              {product ? (
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">Existencia actual</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tabular-nums">{product.stock_quantity}</span>
                    <AvailabilityBadge value={availabilityFor(product.stock_quantity, product.low_stock_threshold)} />
                  </div>
                  <Button variant="outline" size="sm" asChild className="justify-self-start">
                    <Link to={`/admin/inventario?producto=${product.id}`}>
                      <Boxes aria-hidden /> Registrar entrada o ajuste
                    </Link>
                  </Button>
                </div>
              ) : (
                <Field id="p-stock" label="Existencia inicial" error={errors.stock_quantity?.message} hint="Se registra como movimiento de existencia inicial.">
                  <Input type="number" inputMode="numeric" min={0} step={1} {...fieldA11y('p-stock', errors.stock_quantity?.message, 'Se registra como movimiento de existencia inicial.')} {...form.register('stock_quantity', { valueAsNumber: true })} />
                </Field>
              )}
              <Field id="p-threshold" label="Umbral de pocas unidades" error={errors.low_stock_threshold?.message} hint="Con esta cantidad o menos se muestra «Pocas unidades».">
                <Input type="number" inputMode="numeric" min={0} step={1} {...fieldA11y('p-threshold', errors.low_stock_threshold?.message, 'hint')} {...form.register('low_stock_threshold', { valueAsNumber: true })} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagen principal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {currentImage ? (
                <img src={currentImage} alt="Vista previa del producto" className="aspect-square w-full rounded-md border object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Sin imagen</div>
              )}
              <label
                aria-disabled={optimizing || undefined}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted focus-within:ring-3 focus-within:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-60"
              >
                {optimizing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                {optimizing ? 'Optimizando imagen…' : currentImage ? 'Reemplazar imagen' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={optimizing}
                  aria-describedby="p-image-hint"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    const err = validateImageFile(file)
                    setImageError(err)
                    if (err) return
                    setOptimizing(true)
                    try {
                      // Redimensiona (máx. 1200 px) y recomprime a WebP antes de subir.
                      const optimized = await compressProductImage(file).catch(() => file)
                      const uploadErr = validateUploadImage(optimized)
                      setImageError(uploadErr)
                      if (!uploadErr) {
                        setNewImage(optimized)
                        setRemoveImage(false)
                      }
                    } finally {
                      setOptimizing(false)
                    }
                  }}
                />
              </label>
              {currentImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewImage(null)
                    setRemoveImage(true)
                  }}
                >
                  <Trash2 aria-hidden /> Quitar imagen
                </Button>
              )}
              <p id="p-image-hint" className="text-xs text-muted-foreground">
                JPG, PNG o WebP (hasta 20 MB). Se optimiza automáticamente a 1200 px en WebP antes de subirla.
                {newImage && ` Lista para guardar: ${Math.max(1, Math.round(newImage.size / 1024))} KB.`}
              </p>
              {imageError && (
                <p role="alert" className="text-xs text-destructive">
                  {imageError}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibilidad</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <label className="flex items-start gap-3 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                    <span>
                      Activo
                      <span className="block text-xs text-muted-foreground">Los inactivos no se pueden vender ni aparecen en el catálogo.</span>
                    </span>
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="is_published"
                render={({ field }) => (
                  <label className="flex items-start gap-3 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                    <span>
                      Publicado en el catálogo
                      <span className="block text-xs text-muted-foreground">Visible al público con precio y disponibilidad general.</span>
                    </span>
                  </label>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={save.isPending || optimizing || (!isDirty && !newImage && !removeImage && Boolean(product))}>
            {save.isPending ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </>
  )
}
