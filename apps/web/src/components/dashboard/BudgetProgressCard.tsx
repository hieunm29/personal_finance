import { useNavigate } from 'react-router'
import { type BudgetProgressItem, type BudgetWithProgress } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import TransactionCategoryIcon from '../transaction/TransactionCategoryIcon'
import './dashboard-details.css'

interface Props {
  budgetProgress: BudgetProgressItem[] | null
  currency?: string
  month?: string
  progress?: BudgetWithProgress | null
}

function remainingDays(month?: string): number | null {
  const now = new Date()
  const [year, monthNumber] = (month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  if (year !== now.getFullYear() || monthNumber !== now.getMonth() + 1) return null
  return Math.max(lastDay - now.getDate(), 0)
}

function categoryIcon(name: string): string {
  const value = name.toLowerCase()
  if (value.includes('ăn') || value.includes('food')) return 'utensils'
  if (value.includes('nhà') || value.includes('home')) return 'house'
  if (value.includes('mua') || value.includes('shopping')) return 'shirt'
  if (value.includes('di chuyển') || value.includes('xe')) return 'car'
  return 'wallet'
}

export default function BudgetProgressCard({ budgetProgress, currency = 'VND', month, progress }: Props) {
  const navigate = useNavigate()

  if (budgetProgress === null) {
    return (
      <section className="db-card db-detail-budget" aria-label="Ngân sách tháng">
        <div className="db-card-head">
          <div><h2 className="db-card-title">Ngân sách tháng</h2><p className="db-card-sub">Theo dõi chi tiêu theo danh mục</p></div>
        </div>
        <div className="db-empty db-detail-budget-empty"><span aria-hidden="true">💰</span><p>Chưa thiết lập ngân sách tháng</p><button type="button" className="db-link" onClick={() => navigate('/budget')}>Thiết lập →</button></div>
      </section>
    )
  }

  const remaining = progress?.remaining ?? budgetProgress.reduce((sum, item) => sum + item.limit - item.spent, 0)
  const days = remainingDays(month)
  const categoryMeta = new Map(progress?.categories.map((item) => [item.categoryId, item.category]) ?? [])

  return (
    <section className="db-card db-detail-budget" aria-label="Ngân sách tháng">
      <div className="db-card-head">
        <div><h2 className="db-card-title">Ngân sách tháng</h2><p className="db-card-sub num">{remaining >= 0 ? `Còn ${formatCurrency(remaining, currency)}${days === null ? '' : ` cho ${days} ngày`}` : `Đã vượt ${formatCurrency(Math.abs(remaining), currency)}`}</p></div>
        <button type="button" className="db-link" onClick={() => navigate('/budget')}>Chi tiết <span aria-hidden="true">→</span></button>
      </div>
      {budgetProgress.length === 0 ? <div className="db-empty">Chưa có ngân sách theo danh mục</div> : (
        <div className="db-detail-budget-list">
          {budgetProgress.map((item) => {
            const pct = item.limit > 0 ? Math.round((item.spent / item.limit) * 100) : item.spent > 0 ? 101 : 0
            const noLimitOverage = item.limit <= 0 && item.spent > 0
            const cappedPct = Math.min(pct, 100)
            const color = pct >= 100 ? '#DC2626' : pct >= 80 ? '#D97706' : '#059669'
            const meta = categoryMeta.get(item.categoryId)
            return (
              <div className="db-detail-budget-row" key={item.categoryId}>
                <div className="db-detail-budget-top"><span className="db-detail-budget-name"><span className="db-detail-budget-icon" style={{ color: meta?.color ?? color }} aria-hidden="true"><TransactionCategoryIcon icon={meta?.icon ?? categoryIcon(item.categoryName)} name={item.categoryName} size={16} /></span>{item.categoryName}</span><span className="db-detail-budget-value"><strong style={{ color: pct >= 100 ? '#DC2626' : undefined }}>{formatCurrency(item.spent, currency)}</strong> / {formatCurrency(item.limit, currency)}</span></div>
                <div className="db-bar" aria-label={noLimitOverage ? `${item.categoryName}: đã chi nhưng chưa có hạn mức` : `${item.categoryName}: ${pct}% ngân sách đã dùng`}><span style={{ width: `${cappedPct}%`, background: color }} /></div>
                {(pct > 100 || noLimitOverage) && <p className="db-detail-budget-hint db-detail-negative">Vượt {formatCurrency(Math.max(item.spent - item.limit, 0), currency)}{item.limit > 0 ? ` (${pct}%)` : ' (không có hạn mức)'}</p>}
                {pct >= 80 && pct < 100 && <p className="db-detail-budget-hint db-detail-warn">{pct}% · sắp chạm giới hạn</p>}
                {pct === 100 && <p className="db-detail-budget-hint">100% · đã dùng hết ngân sách</p>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
