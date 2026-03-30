import { useState, type ReactNode } from 'react'
import type { DateFilterPreset, Transaction } from '@pf/shared'

import {
  useAnnualSummary,
  useAssetAllocation,
  useBudgetVsActual,
  useExpensesByCategory,
  useIncomeExpenseTrend,
  useMonthlyOverview,
  useNetWorthHistory,
  useTopExpenses,
} from '../hooks/useReports'
import { formatCurrency } from '../utils/format'
import AnnualBarChart from '../components/reports/AnnualBarChart'
import AssetAllocationChart from '../components/reports/AssetAllocationChart'
import BudgetComparisonChart from '../components/reports/BudgetComparisonChart'
import CategoryPieChart from '../components/reports/CategoryPieChart'
import { CategoryDrilldownModal } from '../components/reports/CategoryDrilldownModal'
import IncomeExpenseBarChart from '../components/reports/IncomeExpenseBarChart'
import NetWorthTrendChart from '../components/reports/NetWorthTrendChart'
import { PeriodFilter, computeDateRange } from '../components/reports/PeriodFilter'
import { TopExpensesTable } from '../components/reports/TopExpensesTable'
import TrendLineChart from '../components/reports/TrendLineChart'

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'categories', label: 'Theo danh mục' },
  { id: 'trend', label: 'Xu hướng' },
  { id: 'budget', label: 'Ngân sách' },
  { id: 'assets', label: 'Tài sản' },
  { id: 'annual', label: 'Báo cáo năm' },
] as const

type TabId = (typeof TABS)[number]['id']
type PeriodValue = { filter: DateFilterPreset | 'custom'; startDate: string; endDate: string }
type MetricTone = 'income' | 'expense' | 'savings' | 'neutral'
type AssetsPeriod = '6' | '12' | 'all'

const TAB_CONTENT: Record<TabId, { eyebrow: string; description: string }> = {
  overview: {
    eyebrow: 'Executive Finance',
    description: 'Tổng hợp thu, chi và mức tiết kiệm trong kỳ để theo dõi hiệu quả dòng tiền.',
  },
  categories: {
    eyebrow: 'Category Mix',
    description: 'So sánh cơ cấu chi tiêu theo danh mục để nhận diện nhóm đang chi phối ngân sách.',
  },
  trend: {
    eyebrow: 'Trend Watch',
    description: 'Theo dõi diễn biến thu chi qua thời gian và các giao dịch lớn cần chú ý.',
  },
  budget: {
    eyebrow: 'Budget Control',
    description: 'Đối chiếu ngân sách với chi tiêu thực tế để phát hiện mức vượt hoặc còn dư.',
  },
  assets: {
    eyebrow: 'Wealth Snapshot',
    description: 'Quan sát phân bổ tài sản và xu hướng tăng trưởng net worth trong một không gian thống nhất.',
  },
  annual: {
    eyebrow: 'Year In Review',
    description: 'Tổng kết toàn năm với chỉ số chính, xu hướng 12 tháng và bảng chênh lệch theo tháng.',
  },
}

function getInitialPeriod(): PeriodValue {
  return { filter: 'this_month', ...computeDateRange('this_month') }
}

function LoadingState() {
  return (
    <div className="report-card report-empty-state">
      <div className="report-empty-state__label">Đang tải dữ liệu báo cáo...</div>
    </div>
  )
}

function ReportSectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="report-section-header">
      <div>
        <h2 className="report-section-header__title">{title}</h2>
        <p className="report-section-header__description">{description}</p>
      </div>
      {action ? <div className="report-section-header__action">{action}</div> : null}
    </div>
  )
}

function ReportCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const classes = ['report-card', className].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      <div className="report-card__header">
        <div>
          <h3 className="report-card__title">{title}</h3>
          {subtitle ? <p className="report-card__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="report-card__action">{action}</div> : null}
      </div>
      <div className="report-card__body">{children}</div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string
  value: string
  meta: string
  tone: MetricTone
}) {
  return (
    <article className={`report-metric-card report-metric-card--${tone}`}>
      <span className="report-metric-card__label">{label}</span>
      <strong className="report-metric-card__value">{value}</strong>
      <span className="report-metric-card__meta">{meta}</span>
    </article>
  )
}

function MonthYearSelector({
  year,
  month,
  onChange,
}: {
  year: number
  month: number
  onChange: (yearValue: number, monthValue: number) => void
}) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, index) => currentYear - index)
  const months = Array.from({ length: 12 }, (_, index) => index + 1)

  return (
    <div className="report-inline-controls">
      <select
        value={month}
        onChange={(event) => onChange(year, Number(event.target.value))}
        className="report-select"
      >
        {months.map((monthValue) => (
          <option key={monthValue} value={monthValue}>
            Tháng {monthValue}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(event) => onChange(Number(event.target.value), month)}
        className="report-select"
      >
        {years.map((yearValue) => (
          <option key={yearValue} value={yearValue}>
            {yearValue}
          </option>
        ))}
      </select>
    </div>
  )
}

function OverviewTab() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const { data, isLoading } = useMonthlyOverview(year, month)
  const { overview, comparison } = data || {}

  const savingsRate =
    overview && overview.totalIncome > 0
      ? Math.round((overview.difference / overview.totalIncome) * 100)
      : 0

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="report-section">
      <ReportSectionHeader
        title="Hiệu suất dòng tiền"
        description="Ba chỉ số quan trọng nhất được ưu tiên ở trên cùng để bạn đọc nhanh bức tranh tài chính tháng."
        action={
          <MonthYearSelector
            year={year}
            month={month}
            onChange={(yearValue, monthValue) => {
              setYear(yearValue)
              setMonth(monthValue)
            }}
          />
        }
      />

      <div className="report-metric-grid">
        <MetricCard
          label="Tổng thu"
          value={formatCurrency(overview?.totalIncome || 0)}
          meta={`${overview?.incomeCount || 0} giao dịch${
            comparison?.incomeChangePercent !== null && comparison?.incomeChangePercent !== undefined
              ? ` • ${comparison.incomeChangePercent >= 0 ? 'Tăng' : 'Giảm'} ${Math.abs(comparison.incomeChangePercent)}%`
              : ''
          }`}
          tone="income"
        />
        <MetricCard
          label="Tổng chi"
          value={formatCurrency(overview?.totalExpense || 0)}
          meta={`${overview?.expenseCount || 0} giao dịch${
            comparison?.expenseChangePercent !== null && comparison?.expenseChangePercent !== undefined
              ? ` • ${comparison.expenseChangePercent >= 0 ? 'Tăng' : 'Giảm'} ${Math.abs(comparison.expenseChangePercent)}%`
              : ''
          }`}
          tone="expense"
        />
        <MetricCard
          label="Tiết kiệm"
          value={formatCurrency(overview?.difference || 0)}
          meta={`${savingsRate}% tỷ lệ tiết kiệm trong kỳ đã chọn`}
          tone="savings"
        />
      </div>

      <ReportCard
        title="Dòng tiền theo tháng"
        subtitle={`So sánh tổng thu và tổng chi cho tháng ${month}/${year}.`}
      >
        {overview ? <IncomeExpenseBarChart data={overview} /> : null}
      </ReportCard>
    </div>
  )
}

function CategoriesTab() {
  const [period, setPeriod] = useState<PeriodValue>(getInitialPeriod)
  const { startDate, endDate } = period
  const { data: categories, isLoading } = useExpensesByCategory(startDate, endDate)
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null)

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="report-section">
      <ReportSectionHeader
        title="Chi tiêu theo danh mục"
        description="Kết hợp donut chart và bảng chi tiết để đọc nhanh danh mục chi phối và drill-down khi cần."
      />

      <div className="report-toolbar">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="report-grid report-grid--wide">
        <ReportCard
          title="Cơ cấu chi tiêu"
          subtitle="Tỷ trọng từng danh mục trong kỳ đã chọn."
        >
          <CategoryPieChart data={categories || []} />
        </ReportCard>

        <ReportCard
          title="Danh mục nổi bật"
          subtitle="Nhấn vào một hàng để xem giao dịch chi tiết của danh mục đó."
        >
          {categories && categories.length > 0 ? (
            <table className="report-table report-table--interactive">
              <thead>
                <tr>
                  <th>Danh mục</th>
                  <th className="report-table__align-right">Số tiền</th>
                  <th className="report-table__align-right">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr
                    key={category.categoryId}
                    onClick={() =>
                      setSelectedCategory({
                        id: category.categoryId,
                        name: category.categoryName,
                      })
                    }
                  >
                    <td>
                      <div className="report-category-cell">
                        <span
                          className="report-category-cell__dot"
                          style={{ backgroundColor: category.categoryColor || '#4f46e5' }}
                        />
                        <div className="report-category-cell__content">
                          <span className="report-category-cell__name">
                            {category.categoryIcon ? `${category.categoryIcon} ` : ''}
                            {category.categoryName}
                          </span>
                          <span className="report-category-cell__hint">Nhấn để xem drill-down</span>
                        </div>
                      </div>
                    </td>
                    <td className="report-table__align-right report-table__value">
                      {formatCurrency(category.totalAmount)}
                    </td>
                    <td className="report-table__align-right">
                      <span className="report-percentage-pill">{category.percentage.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="report-empty-state report-empty-state--compact">
              <div className="report-empty-state__label">Không có chi tiêu trong kỳ đã chọn.</div>
            </div>
          )}
        </ReportCard>
      </div>

      {selectedCategory ? (
        <CategoryDrilldownModal
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

function TrendTab() {
  const [period, setPeriod] = useState<PeriodValue>(getInitialPeriod)
  const { startDate, endDate } = period
  const { data: trend, isLoading: isTrendLoading } = useIncomeExpenseTrend(undefined, startDate, endDate)
  const { data: topExpenses, isLoading: isTopExpensesLoading } = useTopExpenses(startDate, endDate, 10)

  if (isTrendLoading || isTopExpensesLoading) {
    return <LoadingState />
  }

  return (
    <div className="report-section">
      <ReportSectionHeader
        title="Xu hướng thu chi"
        description="Theo dõi chuyển động tổng thể và nhanh chóng phát hiện các giao dịch chi tiêu bất thường."
      />

      <div className="report-toolbar">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="report-grid">
        <ReportCard
          title="Biểu đồ xu hướng"
          subtitle="Thu, chi và mức chi trung bình trong giai đoạn đã chọn."
        >
          <TrendLineChart data={trend || []} />
        </ReportCard>

        <ReportCard
          title="Top 10 chi tiêu lớn nhất"
          subtitle="Danh sách giao dịch cần ưu tiên rà soát trong cùng kỳ."
        >
          <TopExpensesTable data={(topExpenses as Transaction[]) || []} />
        </ReportCard>
      </div>
    </div>
  )
}

function BudgetTab() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const { data, isLoading } = useBudgetVsActual(year, month)

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="report-section">
      <ReportSectionHeader
        title="Kiểm soát ngân sách"
        description="Đặt khu vực chart vào một card duy nhất để việc so sánh kế hoạch và thực tế rõ ràng hơn."
        action={
          <MonthYearSelector
            year={year}
            month={month}
            onChange={(yearValue, monthValue) => {
              setYear(yearValue)
              setMonth(monthValue)
            }}
          />
        }
      />

      <ReportCard
        title="Ngân sách vs thực tế"
        subtitle={`So sánh theo từng danh mục trong tháng ${month}/${year}.`}
      >
        <BudgetComparisonChart data={data || []} />
      </ReportCard>
    </div>
  )
}

function AssetsTab() {
  const [assetsPeriod, setAssetsPeriod] = useState<AssetsPeriod>('12')
  const { data: allocation, isLoading: isAllocationLoading } = useAssetAllocation()
  const { data: netWorthHistory, isLoading: isHistoryLoading } = useNetWorthHistory()

  const historyPoints = netWorthHistory
    ? (assetsPeriod === '6'
        ? (netWorthHistory as unknown[]).slice(-6)
        : assetsPeriod === '12'
          ? (netWorthHistory as unknown[]).slice(-12)
          : netWorthHistory) as import('@pf/shared').NetWorthHistoryPoint[]
    : []

  if (isAllocationLoading || isHistoryLoading) {
    return <LoadingState />
  }

  return (
    <div className="report-section">
      <ReportSectionHeader
        title="Tài sản và net worth"
        description="Kết hợp góc nhìn phân bổ tài sản với đà tăng trưởng tổng tài sản ròng."
      />

      <div className="report-grid">
        <ReportCard
          title="Phân bổ tài sản"
          subtitle="Tỷ trọng từng nhóm tài sản trong danh mục hiện tại."
        >
          <AssetAllocationChart data={allocation || []} />
        </ReportCard>

        <ReportCard
          title="Lịch sử net worth"
          subtitle="Chọn khung thời gian để nhìn rõ mức tăng trưởng gần đây hoặc toàn bộ lịch sử."
          action={
            <div className="report-toggle-group" role="tablist" aria-label="Khung thời gian net worth">
              {(['6', '12', 'all'] as AssetsPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setAssetsPeriod(period)}
                  className={`report-toggle-button${assetsPeriod === period ? ' is-active' : ''}`}
                >
                  {period === '6' ? '6 tháng' : period === '12' ? '12 tháng' : 'Tất cả'}
                </button>
              ))}
            </div>
          }
        >
          <NetWorthTrendChart data={historyPoints} />
        </ReportCard>
      </div>
    </div>
  )
}

function AnnualTab() {
  const [year, setYear] = useState(new Date().getFullYear())
  const { data, isLoading } = useAnnualSummary(year)
  const years = Array.from({ length: 4 }, (_, index) => new Date().getFullYear() - index)

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="report-section">
      <ReportSectionHeader
        title="Tổng kết năm"
        description="Một bố cục rõ thứ tự ưu tiên: KPI trên cùng, xu hướng 12 tháng ở giữa, bảng đối chiếu phía dưới."
        action={
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="report-select"
          >
            {years.map((yearValue) => (
              <option key={yearValue} value={yearValue}>
                {yearValue}
              </option>
            ))}
          </select>
        }
      />

      <div className="report-metric-grid report-metric-grid--dense">
        <MetricCard label="Tổng thu" value={formatCurrency(data?.totalIncome || 0)} meta={`Hiệu quả toàn năm ${year}`} tone="income" />
        <MetricCard label="Tổng chi" value={formatCurrency(data?.totalExpense || 0)} meta="Tổng chi phát sinh trong năm" tone="expense" />
        <MetricCard label="TB thu / tháng" value={formatCurrency(data?.averageIncome || 0)} meta="Mức thu trung bình theo tháng" tone="neutral" />
        <MetricCard label="TB chi / tháng" value={formatCurrency(data?.averageExpense || 0)} meta="Mức chi trung bình theo tháng" tone="savings" />
      </div>

      <ReportCard
        title="Biểu đồ thu chi 12 tháng"
        subtitle="Đặt biểu đồ ở vị trí trung tâm để dễ nhìn nhịp tăng giảm của cả năm."
      >
        <AnnualBarChart data={data?.monthly || []} />
      </ReportCard>

      <ReportCard
        title="Bảng chênh lệch theo tháng"
        subtitle="Các tháng âm được tô nền nhẹ để dễ phát hiện hơn khi rà soát."
      >
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
            {data?.monthly.map((monthItem) => (
              <tr key={monthItem.month} className={monthItem.difference < 0 ? 'report-table__row--negative' : ''}>
                <td>Tháng {parseInt(monthItem.month.split('-')[1], 10)}</td>
                <td className="report-table__align-right report-table__value report-table__value--income">
                  {formatCurrency(monthItem.income)}
                </td>
                <td className="report-table__align-right report-table__value report-table__value--expense">
                  {formatCurrency(monthItem.expense)}
                </td>
                <td
                  className={`report-table__align-right report-table__value ${
                    monthItem.difference >= 0 ? 'report-table__value--income' : 'report-table__value--expense'
                  }`}
                >
                  {formatCurrency(monthItem.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportCard>
    </div>
  )
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="reports-shell">
      <section className="reports-hero">
        <div className="reports-hero__content">
          <div className="reports-hero__copy">
            <span className="reports-hero__eyebrow">Báo cáo tài chính</span>
            <h1 className="reports-hero__title">Báo cáo</h1>
            <p className="reports-hero__subtitle">
              Theo dõi xu hướng chi tiêu, ngân sách và tài sản theo từng giai đoạn trong một workspace rõ ràng hơn.
            </p>
          </div>

          <div className="reports-hero__spotlight">
            <span className="reports-hero__badge">{TAB_CONTENT[activeTab].eyebrow}</span>
            <strong className="reports-hero__spotlight-title">
              {TABS.find((tab) => tab.id === activeTab)?.label}
            </strong>
            <p className="reports-hero__spotlight-text">{TAB_CONTENT[activeTab].description}</p>
          </div>
        </div>

        <div className="reports-tabs" role="tablist" aria-label="Các loại báo cáo">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              className={`reports-tab${activeTab === tab.id ? ' is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' ? <OverviewTab /> : null}
      {activeTab === 'categories' ? <CategoriesTab /> : null}
      {activeTab === 'trend' ? <TrendTab /> : null}
      {activeTab === 'budget' ? <BudgetTab /> : null}
      {activeTab === 'assets' ? <AssetsTab /> : null}
      {activeTab === 'annual' ? <AnnualTab /> : null}
    </div>
  )
}
