import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Select nativo con el estilo de los inputs. Se prefiere en formularios y filtros
 * por accesibilidad y compatibilidad con react-hook-form (register).
 */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>option]:bg-popover',
        className,
      )}
      {...props}
    />
  )
}
