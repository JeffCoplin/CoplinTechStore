import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const PAGE_SIZE = 25

export function Pagination({ page, pageSize = PAGE_SIZE, total, onPageChange }: { page: number; pageSize?: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Página {page + 1} de {pages} · {total} registros
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden /> Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => onPageChange(page + 1)}>
          Siguiente <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
