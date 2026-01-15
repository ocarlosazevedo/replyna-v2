import { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns'

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

  useEffect(() => {
    setTempRange(value)
  }, [value, open])

  const shortcuts = useMemo(() => {
    const normalizeDate = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const today = normalizeDate(new Date())
    const yesterday = subDays(today, 1)
    return [
      { label: 'Hoje', range: { from: today, to: today } },
      { label: 'Ontem', range: { from: yesterday, to: yesterday } },
      { label: 'Últimos 7 dias', range: { from: subDays(today, 6), to: today } },
      { label: 'Últimos 30 dias', range: { from: subDays(today, 29), to: today } },
      { label: 'Este mês', range: { from: startOfMonth(today), to: endOfMonth(today) } },
      {
        label: 'Mês passado',
        range: {
          from: startOfMonth(subMonths(today, 1)),
          to: endOfMonth(subMonths(today, 1)),
        },
      },
      { label: 'Últimos 90 dias', range: { from: subDays(today, 90), to: today } },
    ]
  }, [])

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
        onClick={() => setOpen(true)}
        style={{
          backgroundColor: '#ffffff',
          color: '#0e1729',
          borderRadius: '10px',
          border: '1px solid #d7deef',
          padding: '10px 14px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          minWidth: '220px',
        }}
      >
        {rangeLabel}
      </button>

      {open && (
        <div className="replyna-date-overlay">
          <div className="replyna-date-popover">
            <div className="replyna-date-header">
              <div className="replyna-date-inputs">
                <div className="replyna-date-input">{formatDate(tempRange?.from)}</div>
                <span className="replyna-date-separator">→</span>
                <div className="replyna-date-input">{formatDate(tempRange?.to)}</div>
              </div>
            </div>

            <div className="replyna-date-body">
              <div className="replyna-date-shortcuts">
                <div className="replyna-date-shortcuts-title">Atalhos</div>
                <div className="replyna-date-shortcuts-list">
                  {shortcuts.map((shortcut) => (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={() => setTempRange(shortcut.range)}
                      className={`replyna-date-shortcut ${
                        isActiveShortcut(shortcut.range) ? 'active' : ''
                      }`}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="replyna-date-calendar">
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
                  className="replyna-day-picker"
                />
              </div>
            </div>

            <div className="replyna-date-footer">
              <button type="button" className="replyna-date-cancel" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="button" className="replyna-date-apply" onClick={handleApply}>
                Aplicar
              </button>
            </div>
          </div>
          <button type="button" className="replyna-date-backdrop" onClick={handleCancel} />
        </div>
      )}
    </div>
  )
}
