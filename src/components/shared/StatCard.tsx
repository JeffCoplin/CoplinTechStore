import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export function StatCard({ label, value, icon: Icon, hint }: { label: string; value: ReactNode; icon?: LucideIcon; hint?: ReactNode }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}
