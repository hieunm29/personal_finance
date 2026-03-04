import type { BudgetHistory } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

interface Props {
  history: BudgetHistory[]
  onSelectMonth: (month: string) => void
}

function formatMonth(month: string): string {
  const [year, mon] = month.split('-')
  return `Tháng ${Number(mon)}/${year}`
}

export default function BudgetHistoryList({ history, onSelectMonth }: Props) {
  if (history.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Chưa có lịch sử ngân sách</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            {['Tháng', 'Ngân sách', 'Thực chi', 'Chênh lệch'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((item) => {
            const isOver = item.overage > 0
            const isEven = item.overage === 0
            const diffColor = isOver ? '#dc2626' : isEven ? '#94a3b8' : '#16a34a'
            const diffIcon = isOver ? '↑' : isEven ? '—' : '↓'
            return (
              <tr
                key={item.month}
                onClick={() => onSelectMonth(item.month)}
                className="budget-history-row"
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
              >
                <td style={{ padding: '10px 12px', color: '#4f46e5', fontWeight: 500 }}>{formatMonth(item.month)}</td>
                <td style={{ padding: '10px 12px', color: '#0f172a' }}>{formatCurrency(item.totalLimit)}</td>
                <td style={{ padding: '10px 12px', color: '#0f172a' }}>{formatCurrency(item.totalSpent)}</td>
                <td style={{ padding: '10px 12px', color: diffColor, fontWeight: 500 }}>
                  {diffIcon} {formatCurrency(Math.abs(item.overage))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
