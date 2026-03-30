import { useEffect, useCallback } from 'react'
import type { Transaction } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import { useTransactionsByCategory } from '../../hooks/useReports'

export interface CategoryDrilldownModalProps {
  isOpen: boolean
  onClose: () => void
  categoryId: string
  categoryName: string
  startDate: string
  endDate: string
}

export function CategoryDrilldownModal({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  startDate,
  endDate,
}: CategoryDrilldownModalProps) {
  const { data: transactions, isLoading } = useTransactionsByCategory(categoryId, startDate, endDate)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  // Sort by date DESC, then amount DESC
  const sortedTransactions = transactions
    ? [...(transactions as Transaction[])].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date)
        if (dateCompare !== 0) return dateCompare
        return b.amount - a.amount
      })
    : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            {categoryName}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#94a3b8',
              fontSize: '18px',
              lineHeight: 1,
            }}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', maxHeight: '480px', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</div>
          ) : sortedTransactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Không có giao dịch
            </div>
          ) : (
            <table className="drilldown-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '8px 4px',
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: 500,
                    }}
                  >
                    Ngày
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '8px 4px',
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: 500,
                    }}
                  >
                    Số tiền
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '8px 4px',
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: 500,
                    }}
                  >
                    Ghi chú
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 4px', fontSize: '13px', color: '#475569' }}>
                      {t.date}
                    </td>
                    <td
                      style={{
                        padding: '10px 4px',
                        fontSize: '13px',
                        textAlign: 'right',
                        color: '#dc2626',
                        fontWeight: 500,
                      }}
                    >
                      {formatCurrency(t.amount)}
                    </td>
                    <td style={{ padding: '10px 4px', fontSize: '13px', color: '#64748b' }}>
                      {t.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
