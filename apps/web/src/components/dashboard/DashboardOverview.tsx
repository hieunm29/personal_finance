import type {
  BudgetWithProgress,
  DashboardData,
  NetWorthData,
  NetWorthHistoryPoint,
  MonthlyChartPoint,
} from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import './dashboard-overview.css'

interface NetWorthOverviewProps {
  netWorth?: NetWorthData
  history?: NetWorthHistoryPoint[]
  currency: string
  loading?: boolean
}

interface FinancialHealthCardProps {
  dashboard: DashboardData
  budget?: BudgetWithProgress | null
  month: string
  currency: string
}

interface DashboardKpisProps {
  dashboard: DashboardData
  month: string
  currency: string
}

const SPARKLINE_WIDTH = 96
const SPARKLINE_HEIGHT = 32

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!year || !monthNumber) return month
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNumber - 1, 1))
}

function monthDays(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!year || !monthNumber) return 1
  return new Date(year, monthNumber, 0).getDate()
}

function isCurrentMonth(month: string): boolean {
  const now = new Date()
  return month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function divisorForMonth(month: string): number {
  if (!isCurrentMonth(month)) return monthDays(month)
  return Math.max(new Date().getDate(), 1)
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function TrendBadge({ value, reverseColor = false }: { value: number | null; reverseColor?: boolean }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="db-badge">—</span>
  }

  const rounded = Math.round(value * 10) / 10
  const isUp = rounded >= 0
  const isGood = reverseColor ? !isUp : isUp
  const sign = isUp ? '↑' : '↓'

  return (
    <span className={`db-badge ${isGood ? 'good' : 'bad'}`}>
      {sign} {Math.abs(rounded).toFixed(1)}%
    </span>
  )
}

function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (SPARKLINE_WIDTH - 4) + 2
    const y = SPARKLINE_HEIGHT - 4 - ((value - min) / range) * (SPARKLINE_HEIGHT - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg
      className="db-overview-sparkline"
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      role="img"
      aria-label={label}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function netWorthSparklinePath(history: NetWorthHistoryPoint[]): string | null {
  if (history.length < 2) return null
  const values = history.map((point) => point.netWorth)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 300
      const y = 76 - ((value - min) / range) * 62
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function LoadingOverview() {
  return <div className="db-card db-overview-loading" aria-label="Đang tải dữ liệu tài sản" />
}

export function NetWorthOverview({ netWorth, history = [], currency, loading = false }: NetWorthOverviewProps) {
  if (loading) return <LoadingOverview />

  const sparklinePoints = netWorthSparklinePath(history)
  const previous = history.length > 1 ? history[history.length - 2] : undefined
  const latest = history.length > 0 ? history[history.length - 1] : undefined
  const change = latest && previous ? latest.netWorth - previous.netWorth : null
  const changePct = latest && previous ? percentChange(latest.netWorth, previous.netWorth) : null
  const allocations = netWorth?.byType ?? []
  const hasNetWorthData = netWorth !== undefined && (
    allocations.length > 0 || netWorth.totalAssets !== 0 || netWorth.totalDebt !== 0
  )

  return (
    <article className="db-card db-overview-net-worth" aria-label="Giá trị tài sản ròng">
      {hasNetWorthData && netWorth ? (
        <>
          <div className="db-overview-net-worth-top">
            <div>
              <div className="db-overview-eyebrow">
                <span aria-hidden="true">◈</span>
                Tổng tài sản ròng · hiện tại
              </div>
              <div className="db-overview-net-worth-value">
                {formatCurrency(netWorth.netWorth, currency)}
              </div>
              {change !== null && (
                <div className={`db-overview-delta ${change < 0 ? 'db-overview-delta-negative' : ''}`}>
                  <strong>{change >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(change), currency)}</strong>
                  {changePct !== null && ` (${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%)`}
                  <span>so với bản ghi trước</span>
                </div>
              )}
            </div>
            {sparklinePoints && (
              <svg
                className="db-overview-net-worth-spark"
                viewBox="0 0 300 80"
                role="img"
                aria-label="Xu hướng giá trị tài sản ròng"
              >
                <polyline
                  points={sparklinePoints}
                  fill="none"
                  stroke="#E0E7FF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>

          {allocations.length > 0 ? (
            <div className="db-overview-allocation">
              <div className="db-overview-allocation-bar" aria-label="Phân bổ tài sản">
                {allocations.map((allocation) => (
                  <span
                    key={allocation.type}
                    style={{ width: `${Math.max(allocation.percentage, 0)}%` }}
                    title={`${allocation.label}: ${allocation.percentage}%`}
                  />
                ))}
              </div>
              <div className="db-overview-allocation-list">
                {allocations.map((allocation) => (
                  <div key={allocation.type} className="db-overview-allocation-item">
                    <div>
                      <span className="db-swatch" />
                      {allocation.label} · {allocation.percentage}%
                    </div>
                    <strong>{formatCurrency(allocation.totalValue, currency)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="db-empty db-overview-empty-on-dark">Chưa có dữ liệu phân bổ tài sản.</p>
          )}

          <div className="db-overview-net-worth-stats">
            <div>
              <span>Tổng tài sản</span>
              <strong>{formatCurrency(netWorth.totalAssets, currency)}</strong>
            </div>
            <div>
              <span>Tổng nợ</span>
              <strong>{formatCurrency(netWorth.totalDebt, currency)}</strong>
            </div>
            <div>
              <span>Nhóm tài sản</span>
              <strong>{allocations.length}</strong>
            </div>
          </div>
        </>
      ) : (
        <div className="db-overview-unavailable">
          <div className="db-overview-eyebrow">Giá trị hiện tại</div>
          <strong>Chưa có dữ liệu tài sản</strong>
          <p className="db-empty db-overview-empty-on-dark">
            Thêm tài sản để theo dõi giá trị ròng và phân bổ tài sản.
          </p>
          <a className="db-link db-overview-assets-link" href="/assets">Thêm tài sản <span aria-hidden="true">→</span></a>
        </div>
      )}
    </article>
  )
}

export function FinancialHealthCard({ dashboard, budget, month, currency }: FinancialHealthCardProps) {
  const savingsRate = dashboard.totalIncome > 0
    ? (dashboard.netAmount / dashboard.totalIncome) * 100
    : null
  const ringValue = savingsRate === null ? 0 : Math.min(Math.max(savingsRate, 0), 100)
  const categoryOverages = budget?.categories.filter((category) => category.percentage > 100) ?? []
  const budgetPercentage = budget?.percentage ?? null
  const hasPositiveSavings = savingsRate !== null && savingsRate >= 0
  const healthTone = !hasPositiveSavings || (budgetPercentage !== null && budgetPercentage > 100)
    ? 'bad'
    : budgetPercentage !== null && budgetPercentage > 80
      ? 'warn'
      : 'good'
  const healthLabel = !hasPositiveSavings
    ? 'Cần chú ý'
    : budgetPercentage !== null && budgetPercentage > 100
      ? 'Vượt ngân sách'
      : budgetPercentage !== null && budgetPercentage > 80
        ? 'Gần giới hạn'
        : 'Tích cực'
  const circumference = 2 * Math.PI * 50

  return (
    <article className="db-card db-overview-health" aria-label="Sức khỏe tài chính">
      <div className="db-card-head">
        <div>
          <h2 className="db-card-title">Sức khỏe tài chính</h2>
          <p className="db-card-sub">{formatMonth(month)}</p>
        </div>
        <span className={`db-badge ${healthTone}`}>{healthLabel}</span>
      </div>

      <div className="db-overview-health-grid">
        <div className="db-overview-ring" aria-label={savingsRate === null ? 'Chưa có tỷ lệ tiết kiệm' : `Tỷ lệ tiết kiệm ${Math.round(savingsRate)}%`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#EEF0F5" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#059669"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(ringValue / 100) * circumference} ${circumference}`}
            />
          </svg>
          <div className="db-overview-ring-center">
            <strong>{savingsRate === null ? '—' : `${Math.round(savingsRate)}%`}</strong>
            <span>tỷ lệ tiết kiệm</span>
          </div>
        </div>

        <div className="db-overview-health-metrics">
          <div>
            <div className="db-overview-metric-top">
              <span>Ngân sách đã dùng</span>
              <b>{budgetPercentage === null ? '—' : `${budgetPercentage}%`}</b>
            </div>
            <div className="db-bar">
              {budgetPercentage !== null && <span style={{ width: `${Math.min(Math.max(budgetPercentage, 0), 100)}%` }} />}
            </div>
            <p className="db-overview-hint">
              {budget
                ? `${formatCurrency(budget.totalSpent, currency)} / ${formatCurrency(budget.totalLimit, currency)}`
                : 'Chưa thiết lập ngân sách tháng'}
            </p>
          </div>

          <div>
            <div className="db-overview-metric-top">
              <span>Danh mục vượt ngân sách</span>
              <b className={categoryOverages.length > 0 ? 'db-overview-danger-text' : undefined}>
                {budget ? `${categoryOverages.length} / ${budget.categories.length}` : '—'}
              </b>
            </div>
            <p className="db-overview-hint">
              {categoryOverages[0]
                ? `${categoryOverages[0].category.name} vượt ${formatCurrency(Math.abs(categoryOverages[0].remaining), currency)}`
                : budget
                  ? 'Không có danh mục vượt giới hạn'
                  : 'Chưa có dữ liệu ngân sách'}
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}

function chartValues(data: MonthlyChartPoint[], selector: (point: MonthlyChartPoint) => number): number[] {
  return data.map(selector)
}

function KpiCard({
  title,
  amount,
  trend,
  reverseTrend,
  color,
  icon,
  sparkline,
  footnote,
  footnoteTitle,
  amountTone,
}: {
  title: string
  amount: string
  trend?: number | null
  reverseTrend?: boolean
  color: 'income' | 'expense' | 'info' | 'brand'
  icon: string
  sparkline?: number[]
  footnote?: string
  footnoteTitle?: string
  amountTone?: 'positive' | 'negative'
}) {
  return (
    <article className="db-card db-overview-kpi">
      <div className="db-overview-kpi-head">
        <span className={`db-overview-kpi-icon db-overview-kpi-icon-${color}`} aria-hidden="true">{icon}</span>
        <span>{title}</span>
      </div>
      <div className={`db-overview-kpi-value ${amountTone ? `db-overview-kpi-value-${amountTone}` : ''}`}>{amount}</div>
      <div className="db-overview-kpi-foot">
        {trend !== undefined ? <TrendBadge value={trend ?? null} reverseColor={reverseTrend} /> : footnote && <span className="db-badge warn" title={footnoteTitle}>{footnote}</span>}
        {trend !== undefined && <span className="db-card-sub">vs tháng trước</span>}
        {sparkline && <Sparkline values={sparkline} color={color === 'expense' ? '#DC2626' : color === 'info' ? '#2563EB' : '#059669'} label={`Xu hướng ${title.toLowerCase()}`} />}
      </div>
    </article>
  )
}

export function DashboardKpis({ dashboard, month, currency }: DashboardKpisProps) {
  const previousNet = dashboard.prevMonthIncome - dashboard.prevMonthExpense
  const dailyExpense = Math.round(dashboard.totalExpense / divisorForMonth(month))
  // "Còn X/ngày" do server tính (đã trừ hóa đơn định kỳ chưa ghi, số ngày tính cả hôm nay) — xem getSafeToSpend.
  const safe = dashboard.safeToSpend
  const dailyBudget = safe && safe.remaining >= 0 ? safe.perDay : null
  const dailyBudgetTitle = safe
    ? `Còn ${safe.daysLeft} ngày (tính cả hôm nay)${safe.upcomingBills > 0 ? `, đã trừ ${formatCurrency(safe.upcomingBills, currency)} hóa đơn định kỳ chưa ghi` : ''}`
    : undefined
  const points = dashboard.monthlyChart

  return (
    <section className="db-overview-kpis" aria-label="Chỉ số tháng này">
      <KpiCard
        title="Thu nhập"
        amount={formatCurrency(dashboard.totalIncome, currency)}
        trend={percentChange(dashboard.totalIncome, dashboard.prevMonthIncome)}
        color="income"
        icon="↓"
        sparkline={chartValues(points, (point) => point.income)}
      />
      <KpiCard
        title="Chi tiêu"
        amount={formatCurrency(dashboard.totalExpense, currency)}
        trend={percentChange(dashboard.totalExpense, dashboard.prevMonthExpense)}
        reverseTrend
        color="expense"
        icon="↑"
        sparkline={chartValues(points, (point) => point.expense)}
      />
      <KpiCard
        title="Dòng tiền ròng"
        amount={`${dashboard.netAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(dashboard.netAmount), currency)}`}
        trend={percentChange(dashboard.netAmount, previousNet)}
        color="info"
        icon="⚖"
        amountTone={dashboard.netAmount >= 0 ? 'positive' : 'negative'}
        sparkline={chartValues(points, (point) => point.income - point.expense)}
      />
      <KpiCard
        title="Chi tiêu TB / ngày"
        amount={formatCurrency(dailyExpense, currency)}
        color="brand"
        icon="◒"
        footnote={dailyBudget !== null ? `Còn ${formatCurrency(dailyBudget, currency)}/ngày` : undefined}
        footnoteTitle={dailyBudgetTitle}
      />
    </section>
  )
}
