import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { isValidIsoDate, PERIOD_LABELS, resolvePeriod, type Period, type PeriodPreset } from '@/lib/dates/santo-domingo'

export interface PeriodState {
  preset: PeriodPreset
  period: Period
}

export function initialPeriodState(preset: Exclude<PeriodPreset, 'custom'> = 'thisMonth'): PeriodState {
  return { preset, period: resolvePeriod(preset) }
}

export function PeriodFilter({ value, onChange }: { value: PeriodState; onChange: (v: PeriodState) => void }) {
  const [draft, setDraft] = useState<Period>(value.period)
  const invalid = value.preset === 'custom' && (!isValidIsoDate(draft.start) || !isValidIsoDate(draft.end) || draft.end < draft.start)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="period-preset">Período</Label>
        <NativeSelect
          id="period-preset"
          className="w-48"
          value={value.preset}
          onChange={(e) => {
            const preset = e.target.value as PeriodPreset
            if (preset === 'custom') {
              setDraft(value.period)
              onChange({ preset, period: value.period })
            } else {
              onChange({ preset, period: resolvePeriod(preset) })
            }
          }}
        >
          {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {value.preset === 'custom' && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="period-start">Desde</Label>
            <Input
              id="period-start"
              type="date"
              value={draft.start}
              aria-invalid={invalid || undefined}
              onChange={(e) => {
                const next = { ...draft, start: e.target.value }
                setDraft(next)
                if (isValidIsoDate(next.start) && isValidIsoDate(next.end) && next.end >= next.start) onChange({ preset: 'custom', period: next })
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="period-end">Hasta</Label>
            <Input
              id="period-end"
              type="date"
              value={draft.end}
              aria-invalid={invalid || undefined}
              onChange={(e) => {
                const next = { ...draft, end: e.target.value }
                setDraft(next)
                if (isValidIsoDate(next.start) && isValidIsoDate(next.end) && next.end >= next.start) onChange({ preset: 'custom', period: next })
              }}
            />
          </div>
          {invalid && <p role="alert" className="text-xs text-destructive">La fecha final debe ser igual o posterior a la inicial.</p>}
        </>
      )}
    </div>
  )
}
