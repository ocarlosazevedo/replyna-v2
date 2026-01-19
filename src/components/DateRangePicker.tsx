import { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns'
import { ChevronDown } from 'lucide-react'

const formatDate = (date?: Date) => {
  if (!date) return '--/--/----'
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [tempRange, setTempRange] = useState<DateRange>(value)
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  useEffect(() => {
    setTempRange(value)
  }, [value, open])

  const shortcuts = useMemo(() => {
    const yesterday = subDays(today, 1)
    const capToToday = (date: Date) => (date > today ? today : date)
    return [
      { label: 'Hoje', range: { from: today, to: today } },
      { label: 'Ontem', range: { from: yesterday, to: yesterday } },
      { label: 'Últimos 7 dias', range: { from: subDays(today, 6), to: today } },
      { label: 'Últimos 30 dias', range: { from: subDays(today, 29), to: today } },
      { label: 'Este mês', range: { from: startOfMonth(today), to: capToToday(endOfMonth(today)) } },
      {
        label: 'Mês passado',
        range: {
          from: startOfMonth(subMonths(today, 1)),
          to: endOfMonth(subMonths(today, 1)),
        },
      },
      { label: 'Últimos 90 dias', range: { from: subDays(today, 89), to: today } },
    ]
  }, [today])

  const rangeLabel = useMemo(() => {
    if (!value?.from || !value?.to) return 'Selecionar período'
    return `${formatDate(value.from)} → ${formatDate(value.to)}`
  }, [value])

  const handleApply = () => {
    if (!tempRange?.from || !tempRange?.to) return
    onChange(tempRange)
    setOpen(false)
  }

  const handleCancel = () => {
    setTempRange(value)
    setOpen(false)
  }

  const isActiveShortcut = (range: DateRange) => {
    if (!tempRange?.from || !tempRange?.to) return false
    return (
      tempRange.from.toDateString() === range.from?.toDateString() &&
      tempRange.to.toDateString() === range.to?.toDateString()
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="replyna-date-trigger"
      >
        <span>{rangeLabel}</span>
        <ChevronDown size={16} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <>
          <div className="replyna-date-dropdown">
            <div className="replyna-date-dropdown-header">
              <div className="replyna-date-dropdown-inputs">
                <div className="replyna-date-dropdown-input">{formatDate(tempRange?.from)}</div>
                <span style={{ color: 'var(--text-secondary)' }}>→</span>
                <div className="replyna-date-dropdown-input">{formatDate(tempRange?.to)}</div>
              </div>
            </div>

            <div className="replyna-date-dropdown-body">
              <div className="replyna-date-dropdown-shortcuts">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => setTempRange(shortcut.range)}
                    className={`replyna-date-dropdown-shortcut ${
                      isActiveShortcut(shortcut.range) ? 'active' : ''
                    }`}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>

              <div className="replyna-date-dropdown-calendar">
                <DayPicker
                  mode="range"
                  selected={tempRange}
                  onSelect={(range) => {
                    if (!range) return
                    const from = range.from ?? range.to
                    const to = range.to ?? range.from
                    if (from && to && from > to) {
                      setTempRange({ from: to, to: from })
                      return
                    }
                    setTempRange(range)
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  weekStartsOn={1}
                  showOutsideDays
                  disabled={{ after: today }}
                  className="replyna-dropdown-day-picker"
                />
              </div>
            </div>

            <div className="replyna-date-dropdown-footer">
              <button type="button" className="replyna-date-dropdown-cancel" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="button" className="replyna-date-dropdown-apply" onClick={handleApply}>
                Aplicar
              </button>
            </div>
          </div>
          <div className="replyna-date-dropdown-backdrop" onClick={handleCancel} />
        </>
      )}
    </div>
  )
}
