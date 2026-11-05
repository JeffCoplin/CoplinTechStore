import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Field, fieldA11y } from '@/components/shared/Field'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState, QueryBoundary } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toUserMessage } from '@/lib/supabase/errors'
import { slugify } from '@/lib/utils/slug'
import type { Tables } from '@/types/database.types'
import { useCategories, useDeleteCategory, useSaveCategory } from './api'
import { categorySchema, type CategoryValues } from './schema'

type Category = Tables<'categories'>

export default function CategoriesPage() {
  const categories = useCategories()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const del = useDeleteCategory()

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Organiza el catálogo. Solo las categorías activas con productos publicados aparecen al público."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Nueva categoría
          </Button>
        }
      />
      <QueryBoundary query={categories}>
        {categories.data?.length === 0 ? (
          <EmptyState title="Aún no hay categorías" description="Crea la primera para organizar tus productos." />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Slug</TableHead>
                  <TableHead className="w-20 text-right">Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{c.slug}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.sort_order}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? 'secondary' : 'outline'}>{c.is_active ? 'Activa' : 'Inactiva'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Eliminar ${c.name}`} onClick={() => setDeleting(c)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      {editing && <CategoryDialog category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar categoría"
        description={`Se eliminará "${deleting?.name}". Si tiene productos asociados no podrá eliminarse: desactívala o reasigna los productos.`}
        confirmLabel="Eliminar"
        destructive
        pending={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Categoría eliminada')
              setDeleting(null)
            },
            onError: (e) => {
              const code = (e as { code?: string }).code
              toast.error(code === '23503' || code === '23001' ?'La categoría tiene productos asociados. Desactívala o reasigna los productos.' : toUserMessage(e))
            },
          })
        }
      />
    </>
  )
}

function CategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const save = useSaveCategory()
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      sort_order: category?.sort_order ?? 0,
      is_active: category?.is_active ?? true,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: category?.id, values },
      {
        onSuccess: () => {
          toast.success(category ? 'Categoría actualizada' : 'Categoría creada')
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
          <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>El slug se usa en la dirección pública del catálogo.</DialogDescription>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field id="cat-name" label="Nombre" required error={errors.name?.message}>
            <Input
              {...fieldA11y('cat-name', errors.name?.message)}
              {...form.register('name', {
                onChange: (e) => {
                  if (!category && !form.formState.dirtyFields.slug) form.setValue('slug', slugify(e.target.value))
                },
              })}
            />
          </Field>
          <Field id="cat-slug" label="Slug" required error={errors.slug?.message}>
            <Input {...fieldA11y('cat-slug', errors.slug?.message)} {...form.register('slug')} />
          </Field>
          <Field id="cat-order" label="Orden de visualización" error={errors.sort_order?.message}>
            <Input type="number" min={0} step={1} {...fieldA11y('cat-order', errors.sort_order?.message)} {...form.register('sort_order', { valueAsNumber: true })} />
          </Field>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Categoría activa
              </label>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
