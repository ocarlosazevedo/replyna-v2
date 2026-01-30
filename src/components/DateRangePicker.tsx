import { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns'
import { Calendar, ChevronDown } from 'lucide-react'
import { useIsMobile } from '../hooks/useIsMobile'

const formatDate = (date?: Date) => {
  if (!date) return '--/--/----'
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

const formatShortDate = (date?: Date) => {
  if (!date) return '--/--'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [tempRange, setTempRange] = useState<DateRange>(value)
  const isMobile = useIsMobile()
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

  // Encontra o preset ativo baseado no valor atual
  const activePreset = useMemo(() => {
    if (!value?.from || !value?.to) return null
    return shortcuts.find(
      (shortcut) =>
        shortcut.range.from?.toDateString() === value.from?.toDateString() &&
        shortcut.range.to?.toDateString() === value.to?.toDateString()
    )
  }, [value, shortcuts])

  // Label amigável: mostra nome do preset ou "Personalizado" com datas curtas
  const rangeLabel = useMemo(() => {
    if (!value?.from || !value?.to) return 'Selecionar período'
    if (activePreset) return activePreset.label
    return `${formatShortDate(value.from)} → ${formatShortDate(value.to)}`
  }, [value, activePreset])

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

  // Verifica se é um período personalizado (não é preset)
  const isCustomRange = value?.from && value?.to && !activePreset

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`replyna-date-trigger ${isCustomRange ? 'custom' : ''}`}
      >
        <Calendar size={16} style={{ opacity: 0.7 }} />
        <span>{rangeLabel}</span>
        <ChevronDown size={16} style={{ opacity: 0.6, marginLeft: 'auto' }} />
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
                  numberOfMonths={isMobile ? 1 : 2}
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
