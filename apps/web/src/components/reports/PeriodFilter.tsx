import type { ChangeEvent } from 'react'
import type { DateFilterPreset } from '@pf/shared'

export interface PeriodFilterProps {
  value: { filter: DateFilterPreset | 'custom'; startDate: string; endDate: string }
  onChange: (v: { filter: DateFilterPreset | 'custom'; startDate: string; endDate: string }) => void
}

type FilterValue = DateFilterPreset | 'custom'

const PERIOD_PRESETS: { value: FilterValue; label: string }[] = [
  { value: 'this_week', label: 'Tuần này' },
  { value: 'this_month', label: 'Tháng này' },
  { value: 'this_quarter', label: 'Quý này' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'last_year', label: 'Năm trước' },
  { value: 'custom', label: 'Tùy chỉnh' },
]

function computeDateRange(preset: FilterValue): { startDate: string; endDate: string } {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  const fmt = (d: Date) => d.toLocaleDateString('sv')

  // Start of week (Monday)
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  switch (preset) {
    case 'this_week':
      return {
        startDate: fmt(new Date(year, month, day + mondayOffset)),
        endDate: fmt(today),
      }
    case 'this_month':
      return {
        startDate: fmt(new Date(year, month, 1)),
        endDate: fmt(today),
      }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3
      return {
        startDate: fmt(new Date(year, quarterStart, 1)),
        endDate: fmt(today),
      }
    }
    case 'this_year':
      return {
        startDate: fmt(new Date(year, 0, 1)),
        endDate: fmt(today),
      }
    case 'last_month': {
      const lastMonth = month === 0 ? 11 : month - 1
      const lastMonthYear = month === 0 ? year - 1 : year
      const daysInLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate()
      return {
        startDate: fmt(new Date(lastMonthYear, lastMonth, 1)),
        endDate: fmt(new Date(lastMonthYear, lastMonth, daysInLastMonth)),
      }
    }
    case 'last_year': {
      const lastYear = year - 1
      return {
        startDate: fmt(new Date(lastYear, 0, 1)),
        endDate: fmt(new Date(lastYear, 11, 31)),
      }
    }
    default:
      return {
        startDate: fmt(new Date(year, month, 1)),
        endDate: fmt(today),
      }
  }
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const isCustom = value.filter === 'custom'

  const handlePresetClick = (preset: FilterValue) => {
    if (preset === 'custom') {
      onChange({ ...value, filter: 'custom' })
    } else {
      onChange({ filter: preset, ...computeDateRange(preset) })
    }
  }

  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, startDate: e.target.value })
  }

  const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, endDate: e.target.value })
  }

  return (
    <div className="period-filter">
      <div className="period-filter__chips">
        {PERIOD_PRESETS.map((preset) => {
          const isActive = value.filter === preset.value || (value.filter === 'custom' && preset.value === 'custom')
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePresetClick(preset.value)}
              className={`period-btn${isActive ? ' active' : ''}`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {isCustom && (
        <div className="period-filter__custom">
          <input
            type="date"
            value={value.startDate}
            onChange={handleStartDateChange}
            className="period-filter__input"
          />
          <span className="period-filter__separator">→</span>
          <input
            type="date"
            value={value.endDate}
            onChange={handleEndDateChange}
            className="period-filter__input"
          />
        </div>
      )}
    </div>
  )
}

export { computeDateRange }
