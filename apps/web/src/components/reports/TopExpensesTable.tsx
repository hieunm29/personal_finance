import type { Transaction } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

export interface TopExpensesTableProps {
  data: Transaction[]
  currency?: string
}

export function TopExpensesTable({ data, currency }: TopExpensesTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="report-empty-state report-empty-state--compact">
        <div className="report-empty-state__label">Không có chi tiêu</div>
      </div>
    )
  }

  return (
    <table className="report-table top-expenses-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Ngày</th>
          <th className="report-table__align-right">Số tiền</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {data.map((t, i) => (
          <tr key={t.id}>
            <td>
              {i < 3 ? (
                <span className={`rank-badge rank-${i + 1}`}>{i + 1}</span>
              ) : (
                <span className="top-expenses-table__rank">{i + 1}</span>
              )}
            </td>
            <td>{t.date}</td>
            <td className="report-table__align-right report-table__value report-table__value--expense">
              {formatCurrency(t.amount, currency)}
            </td>
            <td className="top-expenses-table__note">{t.note || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
