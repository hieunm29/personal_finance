import { useEffect, useId, useRef } from 'react'
import { formatCurrency, formatDate } from '../../utils/format'
import { useTransactionsByCategory } from '../../hooks/useReports'

export interface CategoryDrilldownModalProps {
  isOpen: boolean
  onClose: () => void
  categoryId: string
  categoryName: string
  startDate: string
  endDate: string
  currency?: string
}

export function CategoryDrilldownModal({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  startDate,
  endDate,
  currency,
}: CategoryDrilldownModalProps) {
  const query = useTransactionsByCategory(categoryId, startDate, endDate)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    if (!isOpen || !element) return
    const opener = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [isOpen])

  if (!isOpen) return null
  return (
    <dialog ref={dialog} aria-labelledby={titleId} className="reports-drilldown reports-print-hide"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section>
        <header>
          <h2 id={titleId}>{categoryName}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <div className="reports-drilldown-body">
          {query.isPending ? <p role="status">Đang tải giao dịch…</p>
            : query.isError ? <p role="alert">Không thể tải giao dịch.</p>
            : !query.data.length ? <p>Không có giao dịch trong kỳ này.</p>
            : (
              <table className="report-table">
                <thead><tr><th>Ngày</th><th className="report-table__align-right">Số tiền</th><th>Ghi chú</th></tr></thead>
                <tbody>
                  {query.data.map(transaction => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.date)}</td>
                      <td className="report-table__align-right report-table__value--expense">
                        {formatCurrency(transaction.amount, currency)}
                      </td>
                      <td>{transaction.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </section>
    </dialog>
  )
}
