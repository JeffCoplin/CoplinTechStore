import { Loader2, Search } from 'lucide-react'
import { useEffect, useId, useState, type KeyboardEvent, type RefObject } from 'react'
import { AvailabilityBadge } from '@/components/shared/AvailabilityBadge'
import { Input } from '@/components/ui/input'
import { formatDOP } from '@/lib/currency/format'
import { availabilityFor } from '@/lib/domain/availability'
import { toUserMessage } from '@/lib/supabase/errors'
import { cn } from '@/lib/utils'
import { useProductSearch, type QuickProduct } from './api'

interface ProductPickerProps {
  label: string
  onSelect: (product: QuickProduct) => void
  includeInactive?: boolean
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  autoFocus?: boolean
}

/** Combobox accesible de búsqueda por nombre, SKU o código de barras. */
export function ProductPicker({ label, onSelect, includeInactive, placeholder = 'Nombre, SKU o código de barras…', inputRef, autoFocus }: ProductPickerProps) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const results = useProductSearch(term, { includeInactive })
  const items = term ? (results.data ?? []) : []

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(draft)
      setActive(0)
    }, 200)
    return () => clearTimeout(t)
  }, [draft])

  const choose = (p: QuickProduct) => {
    onSelect(p)
    setDraft('')
    setTerm('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Enter con coincidencia exacta de SKU/código (lector de barras) o el elemento activo.
      const exact = items.find((p) => p.sku === draft.trim() || p.barcode === draft.trim())
      const pick = exact ?? (term === draft ? items[active] : undefined)
      if (pick) choose(pick)
    } else if (e.key === 'Escape') {
      setDraft('')
    }
  }

  const open = draft.trim().length > 0
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          ref={inputRef}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && items[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-10 pl-9"
        />
        {results.isFetching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          {results.isError ? (
            <li className="px-3 py-2 text-sm text-destructive">{toUserMessage(results.error)}</li>
          ) : term !== draft || results.isPending ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
          ) : (
            items.map((p, i) => (
              <li
                key={p.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-sm', i === active && 'bg-muted')}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {p.name}
                    {!p.is_active && <span className="ml-1 text-xs text-muted-foreground">(inactivo)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.sku ?? 'Sin SKU'} · Existencia: {p.stock_quantity}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums">{formatDOP(p.sale_price)}</span>
                  <AvailabilityBadge value={availabilityFor(p.stock_quantity, p.low_stock_threshold)} />
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
