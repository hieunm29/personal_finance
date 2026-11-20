import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { MonthlyOverview, ReportInsight, ReportPeriodOverview, ReportTabId } from '@pf/shared'
import {
  useAnnualSummary,
  useAssetAllocation,
  useBudgetVsActual,
  useExpensesByCategory,
  useExportReport,
  useIncomeExpenseTrend,
  useNetWorthHistory,
  useReportInsights,
  useReportOverview,
  useReportProfile,
  useTopExpenses,
} from '../hooks/useReports'
import { formatCurrency, formatDate } from '../utils/format'
import AnnualBarChart from '../components/reports/AnnualBarChart'
import AssetAllocationChart from '../components/reports/AssetAllocationChart'
import BudgetComparisonChart from '../components/reports/BudgetComparisonChart'
import CashflowTrendChart from '../components/reports/CashflowTrendChart'
import CategoryPieChart from '../components/reports/CategoryPieChart'
import { CategoryDrilldownModal } from '../components/reports/CategoryDrilldownModal'
import NetWorthTrendChart from '../components/reports/NetWorthTrendChart'
import { TopExpensesTable } from '../components/reports/TopExpensesTable'
import TrendLineChart from '../components/reports/TrendLineChart'
import './reports.css'

type ReportPeriod = {
  preset: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom'
  startDate: string
  endDate: string
}

type AssetHistoryPeriod = '6' | '12' | 'all'
type MetricTone = 'income' | 'expense' | 'savings' | 'rate' | 'neutral'

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z' },
  { id: 'categories', label: 'Theo danh mục', icon: 'M11 3a9 9 0 1 0 10 10H11zM14 3v7h7a9 9 0 0 0-7-7Z' },
  { id: 'trend', label: 'Xu hướng', icon: 'm3 17 6-6 4 4 7-7m-6 0h6v6' },
  { id: 'budget', label: 'Ngân sách', icon: 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Zm-4 0a6 6 0 1 0-12 0 6 6 0 0 0 12 0Zm-4 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z' },
  { id: 'assets', label: 'Tài sản', icon: 'M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7m18 5h-5a2 2 0 0 0 0 4h5' },
  { id: 'annual', label: 'Báo cáo năm', icon: 'M4 6h16v15H4zM4 10h16M8 3v6m8-6v6' },
] as const satisfies ReadonlyArray<{ id: ReportTabId; label: string; icon: string }>

const PRESETS = [
  { id: 'this_month', label: 'Tháng này' },
  { id: 'last_month', label: 'Tháng trước' },
  { id: 'last_3_months', label: '3 tháng' },
  { id: 'last_6_months', label: '6 tháng' },
  { id: 'this_year', label: 'Năm nay' },
  { id: 'custom', label: 'Tùy chọn' },
] as const satisfies ReadonlyArray<{ id: ReportPeriod['preset']; label: string }>

const CALENDAR_ICON = TABS[5].icon
const MAX_TREND_MONTHS = 12

function ReportIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

function localToday() {
  return new Date().toLocaleDateString('sv')
}

function shiftMonthStart(date: string, offset: number): string | null {
  const month = new Date(`${date.slice(0, 7)}-01T00:00:00Z`)
  month.setUTCMonth(month.getUTCMonth() + offset)
  if (month.getUTCFullYear() < 1 || month.getUTCFullYear() > 9999) return null
  return month.toISOString().slice(0, 10)
}

function getMonthEnd(monthStart: string) {
  const month = new Date(`${monthStart}T00:00:00Z`)
  month.setUTCMonth(month.getUTCMonth() + 1, 0)
  return month.toISOString().slice(0, 10)
}

function getPresetPeriod(preset: Exclude<ReportPeriod['preset'], 'custom'>, today = localToday()): ReportPeriod {
  const monthStart = `${today.slice(0, 7)}-01`
  switch (preset) {
    case 'last_month': {
      const startDate = shiftMonthStart(today, -1) ?? '0001-01-01'
      return { preset, startDate, endDate: getMonthEnd(startDate) }
    }
    case 'last_3_months':
    case 'last_6_months': {
      const offset = preset === 'last_3_months' ? -2 : -5
      return { preset, startDate: shiftMonthStart(today, offset) ?? '0001-01-01', endDate: today }
    }
    case 'this_year':
      return { preset, startDate: `${today.slice(0, 4)}-01-01`, endDate: today }
    default:
      return { preset, startDate: monthStart, endDate: today }
  }
}

function getNavigatedPeriod(startDate: string, today: string): ReportPeriod {
  const currentMonth = getPresetPeriod('this_month', today)
  const lastMonth = getPresetPeriod('last_month', today)
  if (startDate === currentMonth.startDate) return currentMonth
  if (startDate === lastMonth.startDate) return lastMonth

  return { preset: 'custom', startDate, endDate: getMonthEnd(startDate) }
}

function ReportStatus({ message, error = false }: { message: string; error?: boolean }) {
  return <p className="reports-status" role={error ? 'alert' : 'status'}>{message}</p>
}

function ReportCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="report-card">
      <div className="report-card__header">
        <div>
          <h2 className="report-card__title">{title}</h2>
          {subtitle ? <p className="report-card__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="report-card__action">{action}</div> : null}
      </div>
      <div className="report-card__body">{children}</div>
    </section>
  )
}

const METRIC_ICONS: Record<MetricTone, string> = {
  income: 'M12 4v15m-6-6 6 6 6-6',
  expense: 'M12 20V5m-6 6 6-6 6 6',
  savings: 'M3 10h3l2-4h9l3 4h2v6h-3l-1 3h-3v-2h-4v2H8l-1-3H4v-4zm12 1h.01',
  rate: 'M12 4v15m-5 1h10M4 7h16M6 7l-3 7h6Zm12 0-3 7h6Z',
  neutral: CALENDAR_ICON,
}

function MetricCard({
  label,
  value,
  meta,
  change,
  tone,
}: {
  label: string
  value: string
  meta?: string
  change?: number | null
  tone: MetricTone
}) {
  const direction = change == null ? null : tone === 'expense' ? -change : change
  const sentiment = direction === null || direction === 0 ? 'neutral' : direction > 0 ? 'positive' : 'negative'

  return (
    <article className={`report-metric-card report-metric-card--${tone}`}>
      <span className="report-metric-card__label">
        <span className="reports-stat-icon"><ReportIcon path={METRIC_ICONS[tone]} /></span>
        {label}
      </span>
      <strong className="report-metric-card__value">{value}</strong>
      {meta || change != null ? (
        <div className="report-metric-card__meta">
          {change != null ? (
            <span
              className={`reports-change reports-change--${sentiment}`}
              aria-label={`${signedNumberFormat.format(change)}${tone === 'rate' ? ' điểm phần trăm' : '%'} so với kỳ trước`}
              title="So với kỳ trước"
            >
              {signedNumberFormat.format(change)}{tone === 'rate' ? ' điểm' : '%'}
            </span>
          ) : null}
          {meta ? <span>{meta}</span> : null}
        </div>
      ) : null}
    </article>
  )
}

function getSavingsRate(overview: MonthlyOverview) {
  return overview.totalIncome > 0 ? (overview.difference / overview.totalIncome) * 100 : null
}

function getMonthCount(startDate: string, endDate: string) {
  const [startYear, startMonth] = startDate.split('-').map(Number)
  const [endYear, endMonth] = endDate.split('-').map(Number)
  return (endYear - startYear) * 12 + endMonth - startMonth + 1
}

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const signedNumberFormat = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

function OverviewMetrics({ data, currency }: { currency: string; data: ReportPeriodOverview }) {
  const { current, previous, changes } = data
  if (current.transactionCount === 0) {
    return <ReportStatus message="Chưa có giao dịch trong kỳ này." />
  }

  const savingsRate = getSavingsRate(current)
  const previousRate = previous ? getSavingsRate(previous.overview) : null
  const previousLabel = previous?.overview.transactionCount ? 'so với kỳ trước' : undefined

  return (
    <div className="report-metric-grid report-metric-grid--dense">
      <MetricCard
        label="Tổng thu"
        value={formatCurrency(current.totalIncome, currency)}
        meta={`${changes.incomePercent === null ? '' : 'so với kỳ trước · '}${current.incomeCount} giao dịch`}
        change={changes.incomePercent}
        tone="income"
      />
      <MetricCard
        label="Tổng chi"
        value={formatCurrency(current.totalExpense, currency)}
        meta={`${changes.expensePercent === null ? '' : 'so với kỳ trước · '}${current.expenseCount} giao dịch`}
        change={changes.expensePercent}
        tone="expense"
      />
      <MetricCard
        label="Tiết kiệm"
        value={formatCurrency(current.difference, currency)}
        meta={previousLabel && previous ? `${previousLabel}: ${formatCurrency(previous.overview.difference, currency)}` : undefined}
        change={changes.savingsPercent}
        tone="savings"
      />
      <MetricCard
        label="Tỷ lệ tiết kiệm"
        value={savingsRate === null ? '—' : `${numberFormat.format(savingsRate)}%`}
        meta={savingsRate === null
          ? 'Chưa có thu nhập trong kỳ'
          : previousRate !== null ? `so với kỳ trước: ${numberFormat.format(previousRate)}%` : undefined}
        change={savingsRate !== null && previousRate !== null ? savingsRate - previousRate : null}
        tone="rate"
      />
    </div>
  )
}

const INSIGHT_TONES = {
  savings: { icon: '✓', tone: 'income' },
  budget: { icon: '!', tone: 'expense' },
  top_expense: { icon: '≡', tone: 'savings' },
} as const

function InsightCards({ insights, currency }: { currency: string; insights: ReportInsight[] }) {
  return (
    <ul className="reports-insights">
      {insights.map((insight) => {
        const { icon, tone } = INSIGHT_TONES[insight.kind]
        const details = [
          insight.amount !== undefined ? formatCurrency(insight.amount, currency) : null,
          insight.percentage !== undefined ? `${numberFormat.format(insight.percentage)}%` : null,
          insight.date ? formatDate(insight.date) : null,
        ].filter(Boolean)

        return (
          <li className={`reports-insight report-metric-card--${tone}`} key={insight.kind}>
            <span className="reports-stat-icon" aria-hidden="true">{icon}</span>
            <div>
              <h3>{insight.title}</h3>
              <p>{insight.description}</p>
              {details.length > 0 ? <p className="reports-insight-details">{details.join(' · ')}</p> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function OverviewTab({
  currency,
  historyStart,
  endDate,
  overview,
  trend,
  insights,
  onViewCategories,
}: {
  currency: string
  historyStart: string
  endDate: string
  overview: ReturnType<typeof useReportOverview>
  trend: ReturnType<typeof useIncomeExpenseTrend>
  insights: ReturnType<typeof useReportInsights>
  onViewCategories: () => void
}) {
  const hasTrendActivity = trend.data?.some(({ totalIncome, totalExpense }) => totalIncome !== 0 || totalExpense !== 0)

  return (
    <div className="report-section">
      {overview.isLoading ? <ReportStatus message="Đang tải tổng quan…" /> : overview.data
        ? <OverviewMetrics currency={currency} data={overview.data} />
        : <ReportStatus message="Không thể tải tổng quan." error />}

      <div className="report-grid reports-overview-grid">
        <ReportCard
          title="Dòng tiền 6 tháng gần nhất"
          subtitle={`${formatDate(historyStart)} – ${formatDate(endDate)}`}
          action={hasTrendActivity ? (
            <div className="reports-chart-legend" aria-hidden="true">
              <span className="reports-legend-income">Thu</span>
              <span className="reports-legend-expense">Chi</span>
              <span className="reports-legend-rate">Tỷ lệ tiết kiệm</span>
            </div>
          ) : undefined}
        >
          {trend.isLoading ? <ReportStatus message="Đang tải dòng tiền…" /> : trend.isError && !trend.data
            ? <ReportStatus message="Không thể tải dòng tiền." error />
            : hasTrendActivity && trend.data ? <CashflowTrendChart currency={currency} data={trend.data} />
              : <ReportStatus message="Chưa có dữ liệu dòng tiền trong 6 tháng này." />}
        </ReportCard>

        <ReportCard title="Điểm nổi bật">
          {insights.isLoading ? <ReportStatus message="Đang tải điểm nổi bật…" /> : insights.isError && !insights.data
            ? <ReportStatus message="Không thể tải điểm nổi bật." error />
            : insights.data?.length ? <InsightCards currency={currency} insights={insights.data} />
              : <ReportStatus message="Chưa có điểm nổi bật trong kỳ này." />}
          <button type="button" className="reports-category-link reports-print-hide" onClick={onViewCategories}>
            Xem chi tiết theo danh mục <span aria-hidden="true">→</span>
          </button>
        </ReportCard>
      </div>
    </div>
  )
}

function CategoriesTab({
  currency,
  period,
  query,
}: {
  currency: string
  period: ReportPeriod
  query: ReturnType<typeof useExpensesByCategory>
}) {
  const { startDate, endDate } = period
  const { data: categories, isLoading, isError } = query
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null)

  if (isLoading) return <ReportStatus message="Đang tải danh mục…" />
  if (isError && !categories) return <ReportStatus message="Không thể tải danh mục." error />

  return (
    <div className="report-section">
      <div className="report-grid report-grid--wide">
        <ReportCard
          title="Cơ cấu chi tiêu"
          subtitle="Tỷ trọng từng danh mục trong kỳ đã chọn."
        >
          <CategoryPieChart currency={currency} data={categories || []} />
        </ReportCard>

        <ReportCard
          title="Danh mục nổi bật"
          subtitle="Chọn một danh mục để xem các giao dịch."
        >
          {categories && categories.length > 0 ? (
            <table className="report-table reports-category-table">
              <thead>
                <tr>
                  <th>Danh mục</th>
                  <th className="report-table__align-right">Số tiền</th>
                  <th className="report-table__align-right">Tỷ trọng</th>
                  <th className="report-table__align-right">So với kỳ trước</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr
                    key={category.categoryId}
                    onClick={(event) => {
                      event.currentTarget.querySelector('button')?.focus()
                      setSelectedCategory({ id: category.categoryId, name: category.categoryName })
                    }}
                  >
                    <td>
                      <button
                        className="report-category-cell"
                        type="button"
                        aria-label={`Xem giao dịch của ${category.categoryName}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          event.currentTarget.focus()
                          setSelectedCategory({ id: category.categoryId, name: category.categoryName })
                        }}
                      >
                        <span className="report-category-cell__dot" aria-hidden="true"
                          style={{ backgroundColor: category.categoryColor || '#4f46e5' }} />
                        {category.categoryIcon ? <span aria-hidden="true">{category.categoryIcon}</span> : null}
                        <span className="report-category-cell__name">{category.categoryName}</span>
                      </button>
                    </td>
                    <td className="report-table__align-right report-table__value">
                      {formatCurrency(category.totalAmount, currency)}
                    </td>
                    <td className="report-table__align-right">
                      <span className="report-percentage-pill">{numberFormat.format(category.percentage)}%</span>
                    </td>
                    <td className="report-table__align-right">
                      {category.changePercent == null ? '—' : `${signedNumberFormat.format(category.changePercent)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ReportStatus message="Không có chi tiêu trong kỳ đã chọn." />
          )}
        </ReportCard>
      </div>

      {selectedCategory ? (
        <CategoryDrilldownModal
          currency={currency}
          isOpen={true}
          onClose={() => setSelectedCategory(null)}
          categoryId={selectedCategory.id}
          categoryName={selectedCategory.name}
          startDate={startDate}
          endDate={endDate}
        />
      ) : null}
    </div>
  )
}

function TrendTab({
  currency,
  trend,
  topExpenses,
}: {
  currency: string
  trend: ReturnType<typeof useIncomeExpenseTrend>
  topExpenses: ReturnType<typeof useTopExpenses>
}) {
  const hasTrendActivity = trend.data?.some(({ totalIncome, totalExpense }) => totalIncome !== 0 || totalExpense !== 0)

  return (
    <div className="report-section">
      <div className="report-grid">
        <ReportCard
          title="Biểu đồ xu hướng"
          subtitle="Thu, chi và mức chi trung bình trong giai đoạn đã chọn."
        >
          {trend.isLoading ? <ReportStatus message="Đang tải xu hướng…" /> : trend.isError && !trend.data
            ? <ReportStatus message="Không thể tải xu hướng." error />
            : hasTrendActivity && trend.data ? <TrendLineChart currency={currency} data={trend.data} />
              : <ReportStatus message="Chưa có dữ liệu thu chi trong kỳ này." />}
        </ReportCard>

        <ReportCard title="Top 10 chi tiêu lớn nhất">
          {topExpenses.isLoading ? <ReportStatus message="Đang tải khoản chi…" /> : topExpenses.data
            ? <TopExpensesTable currency={currency} data={topExpenses.data} />
            : <ReportStatus message="Không thể tải các khoản chi." error />}
        </ReportCard>
      </div>
    </div>
  )
}

function BudgetTab({
  currency,
  year,
  month,
  query,
}: {
  currency: string
  year: number
  month: number
  query: ReturnType<typeof useBudgetVsActual>
}) {
  const { data, isLoading, isError } = query

  return (
    <ReportCard title="Ngân sách so với thực tế" subtitle={`Tháng ${month}/${year}`}>
      {isLoading ? <ReportStatus message="Đang tải ngân sách…" /> : isError && !data
        ? <ReportStatus message="Không thể tải ngân sách." error />
        : <BudgetComparisonChart currency={currency} data={data ?? []} />}
    </ReportCard>
  )
}

function AssetsTab({
  currency,
  allocation,
  history,
  assetHistoryPeriod,
  onPeriodChange,
}: {
  currency: string
  allocation: ReturnType<typeof useAssetAllocation>
  history: ReturnType<typeof useNetWorthHistory>
  assetHistoryPeriod: AssetHistoryPeriod
  onPeriodChange: (period: AssetHistoryPeriod) => void
}) {
  return (
    <div className="report-section">
      <div className="report-grid">
        <ReportCard
          title="Phân bổ tài sản"
          subtitle="Tỷ trọng từng nhóm tài sản trong danh mục hiện tại."
        >
          {allocation.isLoading ? <ReportStatus message="Đang tải phân bổ tài sản…" /> : allocation.data
            ? <AssetAllocationChart currency={currency} data={allocation.data} />
            : <ReportStatus message="Không thể tải phân bổ tài sản." error />}
        </ReportCard>

        <ReportCard
          title="Lịch sử tài sản ròng"
          subtitle={assetHistoryPeriod === 'all' ? 'Toàn bộ lịch sử' : `${assetHistoryPeriod} tháng gần nhất`}
          action={
            <div className="report-toggle-group reports-print-hide" role="group" aria-label="Khung thời gian tài sản ròng">
              {(['6', '12', 'all'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => onPeriodChange(period)}
                  aria-pressed={assetHistoryPeriod === period}
                  className={`report-toggle-button${assetHistoryPeriod === period ? ' is-active' : ''}`}
                >
                  {period === '6' ? '6 tháng' : period === '12' ? '12 tháng' : 'Tất cả'}
                </button>
              ))}
            </div>
          }
        >
          {history.isLoading ? <ReportStatus message="Đang tải lịch sử tài sản ròng…" /> : history.data
            ? <NetWorthTrendChart currency={currency} data={history.data} />
            : <ReportStatus message="Không thể tải lịch sử tài sản ròng." error />}
        </ReportCard>
      </div>
    </div>
  )
}

function AnnualTab({ year, query, currency }: { currency: string; year: number; query: ReturnType<typeof useAnnualSummary> }) {
  const { data, isLoading } = query

  if (isLoading) return <ReportStatus message="Đang tải báo cáo năm…" />
  if (!data) return <ReportStatus message="Không thể tải báo cáo năm." error />

  return (
    <div className="report-section">
      <h2 className="reports-section-title">Tổng kết năm {year}</h2>
      <div className="report-metric-grid report-metric-grid--dense">
        <MetricCard label="Tổng thu" value={formatCurrency(data.totalIncome, currency)} tone="income" />
        <MetricCard label="Tổng chi" value={formatCurrency(data.totalExpense, currency)} tone="expense" />
        <MetricCard label="TB thu / tháng" value={formatCurrency(data.averageIncome, currency)} tone="neutral" />
        <MetricCard label="TB chi / tháng" value={formatCurrency(data.averageExpense, currency)} tone="savings" />
      </div>

      <ReportCard title="Biểu đồ thu chi 12 tháng">
        <AnnualBarChart currency={currency} data={data.monthly} />
      </ReportCard>

      <ReportCard title="Bảng chênh lệch theo tháng">
        <table className="report-table">
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="report-table__align-right">Thu</th>
              <th className="report-table__align-right">Chi</th>
              <th className="report-table__align-right">Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {data.monthly.map((monthItem) => (
              <tr key={monthItem.month} className={monthItem.difference < 0 ? 'report-table__row--negative' : ''}>
                <td>Tháng {parseInt(monthItem.month.split('-')[1], 10)}</td>
                <td className="report-table__align-right report-table__value report-table__value--income">
                  {formatCurrency(monthItem.income, currency)}
                </td>
                <td className="report-table__align-right report-table__value report-table__value--expense">
                  {formatCurrency(monthItem.expense, currency)}
                </td>
                <td
                  className={`report-table__align-right report-table__value ${
                    monthItem.difference >= 0 ? 'report-table__value--income' : 'report-table__value--expense'
                  }`}
                >
                  {formatCurrency(monthItem.difference, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportCard>
    </div>
  )
}

function PeriodControls({
  period,
  previous,
  onChange,
}: {
  period: ReportPeriod
  previous?: ReportPeriodOverview['previous']
  onChange: (period: ReportPeriod) => void
}) {
  const [editingPeriod, setEditingPeriod] = useState<ReportPeriod | null>(null)
  const [dateError, setDateError] = useState('')
  const editing = editingPeriod === period

  function handlePreset(preset: ReportPeriod['preset']) {
    setDateError('')
    setEditingPeriod(preset === 'custom' && !editing ? period : null)
    if (preset !== 'custom') onChange(getPresetPeriod(preset))
  }

  function applyCustomPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const startDate = String(data.get('startDate'))
    const endDate = String(data.get('endDate'))
    if (startDate > endDate) {
      setDateError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')
      return
    }

    setDateError('')
    setEditingPeriod(null)
    onChange({ preset: 'custom', startDate, endDate })
  }

  return (
    <>
      <div className="reports-period-row">
        <div className="reports-presets-scroll reports-print-hide">
          <div className="reports-presets" role="group" aria-label="Kỳ báo cáo">
            {PRESETS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={period.preset === id}
                aria-expanded={id === 'custom' ? editing : undefined}
                onClick={() => handlePreset(id)}
              >
                {id === 'custom' ? <ReportIcon path={CALENDAR_ICON} /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="reports-period-summary">
          <ReportIcon path={CALENDAR_ICON} />
          <span>{formatDate(period.startDate)} – {formatDate(period.endDate)}
            {previous && <span className="reports-previous-period">
              Kỳ trước: {formatDate(previous.startDate)} – {formatDate(previous.endDate)}
            </span>}
          </span>
        </p>
      </div>

      {editing ? (
        <form className="reports-custom-period reports-print-hide" onSubmit={applyCustomPeriod}>
          <label>Từ ngày<input name="startDate" type="date" min="0001-01-01" max="9999-12-31"
            defaultValue={period.startDate} required /></label>
          <label>Đến ngày<input name="endDate" type="date" min="0001-01-01" max="9999-12-31"
            defaultValue={period.endDate} required /></label>
          <button type="submit" className="reports-primary-button">Áp dụng</button>
          {dateError ? <p role="alert">{dateError}</p> : null}
        </form>
      ) : null}
    </>
  )
}

function ReportTabs({ activeTab, onChange }: { activeTab: ReportTabId; onChange: (tab: ReportTabId) => void }) {
  const tabList = useRef<HTMLDivElement>(null)

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    switch (event.key) {
      case 'ArrowLeft':
        next = (index + TABS.length - 1) % TABS.length
        break
      case 'ArrowRight':
        next = (index + 1) % TABS.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = TABS.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    onChange(TABS[next].id)
    tabList.current?.querySelectorAll('button')[next]?.focus()
  }

  return (
    <div className="reports-tabs reports-print-hide" ref={tabList} role="tablist" aria-label="Các loại báo cáo">
      {TABS.map(({ id, label, icon }, index) => (
        <button key={id} type="button" id={`report-tab-${id}`} role="tab" className="reports-tab"
          aria-selected={activeTab === id} aria-controls={activeTab === id ? 'report-panel' : undefined}
          tabIndex={activeTab === id ? 0 : -1}
          onClick={() => onChange(id)} onKeyDown={(event) => handleKeyDown(event, index)}>
          <ReportIcon path={icon} />
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTabId>('overview')
  const [period, setPeriod] = useState(() => getPresetPeriod('this_month'))
  const [assetHistoryPeriod, setAssetHistoryPeriod] = useState<AssetHistoryPeriod>('12')
  const profile = useReportProfile()
  const exportReport = useExportReport()
  const exportMenu = useRef<HTMLDetailsElement>(null)
  const { startDate, endDate } = period
  const [year, month] = endDate.split('-').map(Number)
  const today = localToday()
  const previousMonth = shiftMonthStart(period.endDate, -1)
  const nextMonth = shiftMonthStart(period.endDate, 1)
  const canUseTrend = getMonthCount(startDate, endDate) <= MAX_TREND_MONTHS
  const activeLabel = TABS.find(({ id }) => id === activeTab)?.label
  const historyStart = shiftMonthStart(endDate, -5) ?? '0001-01-01'
  const overviewActive = activeTab === 'overview'
  const trendActive = activeTab === 'trend' && canUseTrend
  const assetsActive = activeTab === 'assets'
  const historyLimit = assetHistoryPeriod === 'all' ? undefined : Number(assetHistoryPeriod)

  const overview = useReportOverview(startDate, endDate, overviewActive || activeTab === 'categories')
  const insights = useReportInsights(startDate, endDate, overviewActive)
  const trend = useIncomeExpenseTrend(undefined, overviewActive ? historyStart : startDate, endDate, overviewActive || trendActive)
  const categories = useExpensesByCategory(startDate, endDate, activeTab === 'categories')
  const topExpenses = useTopExpenses(startDate, endDate, 10, trendActive)
  const budget = useBudgetVsActual(year, month, activeTab === 'budget')
  const allocation = useAssetAllocation(assetsActive)
  const history = useNetWorthHistory(historyLimit, assetsActive)
  const annual = useAnnualSummary(year, activeTab === 'annual')

  const shownQueries = {
    overview: [overview, trend, insights],
    categories: [categories, overview],
    trend: [trend, topExpenses],
    budget: [budget],
    assets: [allocation, history],
    annual: [annual],
  }[activeTab]
  const canPrint = profile.isSuccess && !profile.isFetching && (activeTab !== 'trend' || canUseTrend)
    && shownQueries.every(query => query.isSuccess && query.fetchStatus === 'idle')
  const currency = profile.data?.currency

  function navigateMonth(startDate: string | null) {
    if (startDate) setPeriod(getNavigatedPeriod(startDate, today))
  }

  function closeExportMenu(restoreFocus = false) {
    if (restoreFocus) exportMenu.current?.querySelector('summary')?.focus()
    if (exportMenu.current) exportMenu.current.open = false
  }

  function exportCsv() {
    closeExportMenu(true)
    exportReport.mutate({
      tab: activeTab,
      startDate: period.startDate,
      endDate: period.endDate,
      assetHistoryPeriod,
    })
  }

  function printReport() {
    if (!canPrint) return
    closeExportMenu(true)
    window.print()
  }

  return (
    <div className="reports-shell finance-reports">
      <header className="reports-page-header">
        <div className="reports-page-heading">
          <h1>Báo cáo</h1>
          <p>Phân tích thu chi, ngân sách và tài sản theo kỳ</p>
        </div>

        <div className="reports-page-actions reports-print-hide">
          <div className="reports-month-nav" role="group" aria-label="Điều hướng theo tháng">
            <button type="button" aria-label="Tháng trước" onClick={() => navigateMonth(previousMonth)} disabled={!previousMonth}>
              <ReportIcon path="m15 5-7 7 7 7" />
            </button>
            <span>Tháng {month}/{year}</span>
            <button type="button" aria-label="Tháng sau" onClick={() => navigateMonth(nextMonth)} disabled={!nextMonth}>
              <ReportIcon path="m9 5 7 7-7 7" />
            </button>
          </div>

          <details
            ref={exportMenu}
            className="reports-export-menu"
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeExportMenu()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeExportMenu(true)
            }}
          >
            <summary className="reports-primary-button" aria-label="Xuất báo cáo" title="Xuất báo cáo">
              <ReportIcon path="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
              <span>{exportReport.isPending ? 'Đang xuất…' : 'Xuất báo cáo'}</span>
            </summary>
            <div className="reports-export-options">
              <button type="button" onClick={exportCsv} disabled={!currency || exportReport.isPending || (activeTab === 'trend' && !canUseTrend)}>
                Tải xuống CSV
              </button>
              <button type="button" onClick={printReport} disabled={!canPrint}>In / Lưu PDF</button>
            </div>
          </details>
        </div>
      </header>

      {exportReport.isError ? (
        <p className="reports-export-feedback reports-print-hide" role="alert">
          {exportReport.error.message}
        </p>
      ) : null}

      <PeriodControls period={period} onChange={setPeriod}
        previous={overviewActive || activeTab === 'categories' ? overview.data?.previous : undefined} />
      <ReportTabs activeTab={activeTab} onChange={setActiveTab} />
      <p className="reports-printed-tab">{activeLabel}{currency ? ` · ${currency}` : ''}</p>

      <div id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${activeTab}`} tabIndex={0}>
        {!currency ? <ReportStatus message={profile.isError ? 'Không thể tải hồ sơ báo cáo.' : 'Đang tải báo cáo…'} error={profile.isError} /> : (
          <>
            {activeTab === 'overview' ? (
              <OverviewTab currency={currency}
                historyStart={historyStart}
                endDate={endDate}
                overview={overview}
                trend={trend}
                insights={insights}
                onViewCategories={() => {
                  setActiveTab('categories')
                  document.getElementById('report-tab-categories')?.focus()
                }}
              />
            ) : null}
            {activeTab === 'categories' ? (
              <CategoriesTab currency={currency} key={`${profile.data?.authUserId}:${startDate}:${endDate}`} period={period} query={categories} />
            ) : null}
            {activeTab === 'trend' ? canUseTrend
              ? <TrendTab currency={currency} trend={trend} topExpenses={topExpenses} />
              : <ReportStatus message="Chọn một kỳ tối đa 12 tháng để xem và xuất báo cáo xu hướng." />
              : null}
            {activeTab === 'budget' ? <BudgetTab currency={currency} year={year} month={month} query={budget} /> : null}
            {activeTab === 'assets' ? (
              <AssetsTab currency={currency}
                allocation={allocation}
                history={history}
                assetHistoryPeriod={assetHistoryPeriod}
                onPeriodChange={setAssetHistoryPeriod}
              />
            ) : null}
            {activeTab === 'annual' ? <AnnualTab currency={currency} year={year} query={annual} /> : null}
          </>
        )}
      </div>
    </div>
  )
}
