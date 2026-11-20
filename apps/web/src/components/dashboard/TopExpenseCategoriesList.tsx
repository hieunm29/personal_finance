import { useNavigate } from 'react-router'
import { type TopExpenseCategory } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import './dashboard-details.css'

interface Props {
  categories: TopExpenseCategory[]
  currency: string
  month: string
  totalExpense?: number
}

const COLORS = ['#6366F1', '#F59E0B', '#06B6D4', '#EC4899', '#94A3B8']
const CIRCUMFERENCE = 2 * Math.PI * 54

function compactAmount(amount: number, currency: string): string {
  const value = amount / 100
  if (currency === 'VND' && value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}tr`
  return formatCurrency(amount, currency)
}

interface ExpenseItem extends TopExpenseCategory {
  isRemainder?: boolean
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return { start: `${month}-01`, end: new Date(year, monthNumber, 0).toLocaleDateString('sv') }
}

export default function TopExpenseCategoriesList({ categories, currency, month, totalExpense }: Props) {
  const navigate = useNavigate()
  const { start, end } = monthRange(month)
  const knownTotal = categories.reduce((sum, category) => sum + category.amount, 0)
  const remainder = totalExpense !== undefined ? Math.max(totalExpense - knownTotal, 0) : 0
  const items: ExpenseItem[] = remainder > 0 ? [...categories, {
    categoryId: null,
    categoryName: 'Khác',
    categoryIcon: null,
    categoryColor: '#94A3B8',
    amount: remainder,
    percentage: totalExpense ? Math.round((remainder / totalExpense) * 100) : 0,
    isRemainder: true,
  }] : categories
  const chartTotal = totalExpense ?? knownTotal

  const goToCategory = (item: ExpenseItem) => {
    const params = new URLSearchParams({ dateFrom: start, dateTo: end })
    if (item.categoryId && !item.isRemainder) params.set('categoryId', item.categoryId)
    navigate('/transactions?' + params.toString())
  }

  if (items.length === 0) {
    return (
      <section className="db-card db-detail-expenses" aria-label="Chi tiêu theo danh mục">
        <div className="db-card-head">
          <div><h2 className="db-card-title">Chi tiêu theo danh mục</h2><p className="db-card-sub">Tháng {Number(month.split('-')[1])}/{month.split('-')[0]}</p></div>
        </div>
        <div className="db-empty">Chưa có chi tiêu trong tháng này</div>
      </section>
    )
  }

  let offset = 0
  return (
    <section className="db-card db-detail-expenses" aria-label="Chi tiêu theo danh mục">
      <div className="db-card-head">
        <div><h2 className="db-card-title">Chi tiêu theo danh mục</h2><p className="db-card-sub">Tháng {Number(month.split('-')[1])}/{month.split('-')[0]}</p></div>
        <button type="button" className="db-link db-detail-report-link" onClick={() => navigate('/reports')}>Báo cáo <span aria-hidden="true">→</span></button>
      </div>
      <div className="db-detail-donut-wrap">
        <div className="db-detail-donut" role="img" aria-label={`Cơ cấu chi tiêu, tổng ${formatCurrency(chartTotal, currency)}`}>
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r="54" fill="none" stroke="#EEF0F5" strokeWidth="18" />
            {items.map((item, index) => {
              const length = chartTotal > 0 ? (item.amount / chartTotal) * CIRCUMFERENCE : 0
              const dashOffset = -offset
              offset += length
              return <circle key={`${item.categoryId ?? 'null'}-${index}-arc`} cx="70" cy="70" r="54" fill="none" stroke={item.categoryColor ?? COLORS[index % COLORS.length]} strokeWidth="18" strokeDasharray={`${length} ${CIRCUMFERENCE}`} strokeDashoffset={dashOffset} />
            })}
          </svg>
          <div className="db-detail-donut-center"><strong>{compactAmount(chartTotal, currency)}</strong><span>tổng chi</span></div>
        </div>
        <ul className="db-detail-category-list" aria-label="Danh mục chi tiêu">
          {items.map((item, index) => {
            const color = item.categoryColor ?? COLORS[index % COLORS.length]
            return (
              <li key={`${item.categoryId ?? 'null'}-${item.isRemainder ? 'remainder' : index}`}>
                <button type="button" className="db-detail-category" onClick={() => goToCategory(item)} aria-label={item.isRemainder ? 'Xem tất cả giao dịch trong tháng' : `Lọc giao dịch danh mục ${item.categoryName}`}>
                  <span className="db-detail-category-name"><i className="db-swatch" style={{ background: color }} />{item.categoryName}</span>
                  <span className="db-detail-category-value">{compactAmount(item.amount, currency)} <small>{item.percentage}%</small></span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
