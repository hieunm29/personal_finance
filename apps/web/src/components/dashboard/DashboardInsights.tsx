import { useNavigate } from 'react-router'
import { type DashboardData } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import './dashboard-details.css'

interface Props {
  dashboard: DashboardData
  currency: string
  month: string
}

interface Insight {
  tone: 'bad' | 'warn' | 'good' | 'info'
  title: string
  description: string
  action?: string
  href?: string
}

function isPartialMonth(month: string): boolean {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  return month === currentMonth && today.getDate() < new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
}

export default function DashboardInsights({ dashboard, currency, month }: Props) {
  const navigate = useNavigate()
  const insights: Insight[] = []
  const budgets = dashboard.budgetProgress ?? []
  const overBudget = budgets.filter((item) => item.spent > item.limit)
  const nearBudget = budgets.filter((item) => item.limit > 0 && item.spent >= item.limit * 0.8 && item.spent < item.limit)

  for (const item of overBudget.slice(0, 2)) {
    insights.push({
      tone: 'bad',
      title: `${item.categoryName} vượt ngân sách`,
      description: `Đã chi ${formatCurrency(item.spent, currency)} / ${formatCurrency(item.limit, currency)} dự kiến`,
      action: 'Điều chỉnh ngân sách',
      href: '/budget',
    })
  }

  if (insights.length < 3 && nearBudget.length > 0) {
    const item = nearBudget[0]
    insights.push({
      tone: 'warn',
      title: `${item.categoryName} sắp chạm giới hạn`,
      description: `Đã dùng ${Math.round((item.spent / item.limit) * 100)}% ngân sách tháng ${month.slice(5)}`,
      action: 'Xem ngân sách',
      href: '/budget',
    })
  }

  if (dashboard.prevMonthExpense > 0) {
    const change = (dashboard.totalExpense - dashboard.prevMonthExpense) / dashboard.prevMonthExpense * 100
    if (change < 0) {
      insights.push({
        tone: 'good',
        title: `Chi tiêu giảm ${Math.abs(change).toFixed(1)}%`,
        description: isPartialMonth(month)
          ? `Tạm tính thấp hơn ${formatCurrency(Math.abs(dashboard.totalExpense - dashboard.prevMonthExpense), currency)} so với cả tháng trước`
          : `Thấp hơn ${formatCurrency(Math.abs(dashboard.totalExpense - dashboard.prevMonthExpense), currency)} so với tháng trước`,
      })
    } else if (change > 0 && insights.length < 3) {
      insights.push({
        tone: 'info',
        title: `Chi tiêu tăng ${change.toFixed(1)}%`,
        description: `${formatCurrency(dashboard.totalExpense - dashboard.prevMonthExpense, currency)} so với tháng trước`,
      })
    }
  }

  const visibleInsights = insights.slice(0, 3)
  return (
    <section className="db-card db-detail-insights" aria-label="Cần chú ý">
      <div className="db-card-head">
        <div><h2 className="db-card-title">Cần chú ý</h2><p className="db-card-sub">Gợi ý dựa trên dữ liệu của bạn</p></div>
        <span className={`db-badge ${visibleInsights.some((item) => item.tone === 'bad') ? 'bad' : visibleInsights.length ? 'info' : 'good'}`}>{visibleInsights.length}</span>
      </div>
      {visibleInsights.length === 0 ? <div className="db-empty">Chưa có lưu ý từ dữ liệu hiện tại</div> : (
        <div className="db-detail-insight-list">
          {visibleInsights.map((insight, index) => (
            <div key={`${insight.title}-${index}`} className={`db-detail-insight ${insight.tone}`}>
              <span className="db-detail-insight-icon" aria-hidden="true">{insight.tone === 'bad' ? '!' : insight.tone === 'warn' ? '◷' : insight.tone === 'good' ? '✓' : '⌁'}</span>
              <div><p className="db-detail-insight-title">{insight.title}</p><p className="db-detail-insight-description">{insight.description}</p>{insight.action && insight.href && <button type="button" className="db-link db-detail-insight-link" onClick={() => navigate(insight.href!)}>{insight.action}</button>}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
