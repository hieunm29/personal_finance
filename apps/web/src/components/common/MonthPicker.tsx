import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './month-picker.css'

/**
 * Chọn tháng (YYYY-MM) bằng bảng 12 tháng tự vẽ.
 * Thay cho <input type="month">: Safari trên macOS không hỗ trợ kiểu input này
 * (bấm vào không mở gì), nên không dựa vào bảng chọn của trình duyệt.
 */
type TriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & { 'data-month'?: string }

interface MonthPickerProps {
  value: string
  onChange: (month: string) => void
  /** Tháng nhỏ nhất được chọn, dạng YYYY-MM. */
  min?: string
  /** Tháng lớn nhất được chọn, dạng YYYY-MM. Bỏ trống = không giới hạn. */
  max?: string
  /** Nội dung hiển thị bên trong nút (icon, nhãn…). */
  children: ReactNode
  /** Thuộc tính cho nút mở bảng, giữ nguyên class giao diện của từng trang. */
  triggerProps?: TriggerProps
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

function toMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function MonthPicker({ value, onChange, min = '2000-01', max, children, triggerProps }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const minYear = Number(min.slice(0, 4))
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity
  const isDisabled = (month: string) => month < min || (max !== undefined && month > max)

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function toggle() {
    if (!open) setViewYear(Number(value.slice(0, 4)))
    setOpen(!open)
  }

  function select(month: string) {
    if (isDisabled(month)) return
    if (month !== value) onChange(month)
    close(true)
  }

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Mở bảng thì đưa focus vào tháng đang chọn (hoặc tháng đầu tiên chọn được).
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const target = panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)')
      ?? panel?.querySelector<HTMLButtonElement>('.month-picker-month:not(:disabled)')
    target?.focus()
  }, [open])

  return (
    <div className="month-picker" ref={rootRef}>
      <button
        {...triggerProps}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      >
        {children}
      </button>
      {open ? (
        <div className="month-picker-panel" id={panelId} role="dialog" aria-label="Chọn tháng" ref={panelRef}>
          <div className="month-picker-head">
            <button type="button" className="month-picker-nav" aria-label="Năm trước" disabled={viewYear <= minYear} onClick={() => setViewYear(viewYear - 1)}>‹</button>
            <span className="month-picker-year" aria-live="polite">{viewYear}</span>
            <button type="button" className="month-picker-nav" aria-label="Năm sau" disabled={viewYear >= maxYear} onClick={() => setViewYear(viewYear + 1)}>›</button>
          </div>
          <div className="month-picker-grid">
            {MONTHS.map(monthNumber => {
              const month = toMonth(viewYear, monthNumber)
              const selected = month === value
              return (
                <button
                  key={month}
                  type="button"
                  className={`month-picker-month${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  aria-label={`Tháng ${monthNumber}/${viewYear}`}
                  disabled={isDisabled(month)}
                  onClick={() => select(month)}
                >
                  T{monthNumber}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
