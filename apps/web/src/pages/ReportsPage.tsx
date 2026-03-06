import { useState, useMemo } from 'react'
import { formatCurrency } from '../utils/format'
import {
  useMonthlyOverview,
  useExpensesByCategory,
  useTransactionsByCategory,
  useIncomeExpenseTrend,
  useBudgetVsActual,
  useAssetAllocation,
  useNetWorthHistory,
  useTopExpenses,
  useAnnualSummary,
} from '../hooks/useReports'
import type { DateFilterPreset } from '@pf/shared'

// Period filter presets
const PERIOD_PRESETS: { value: DateFilterPreset; label: string }[] = [
  { value: 'this_month', label: 'Tháng này' },
  { value: 'this_quarter', label: 'Quý này' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'last_month', label: 'Tháng trước' },
]

// Compute date range from preset
function getDateRangeFromPreset(preset: DateFilterPreset): { startDate: string; endDate: string } {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  const fmt = (d: Date) => d.toLocaleDateString('sv')

  switch (preset) {
    case 'this_month':
      return { startDate: fmt(new Date(year, month, 1)), endDate: fmt(today) }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3
      return { startDate: fmt(new Date(year, quarterStart, 1)), endDate: fmt(today) }
    }
    case 'this_year':
      return { startDate: fmt(new Date(year, 0, 1)), endDate: fmt(today) }
    case 'last_month': {
      const lastMonth = month === 0 ? 11 : month - 1
      const lastMonthYear = month === 0 ? year - 1 : year
      const daysInLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate()
      return {
        startDate: fmt(new Date(lastMonthYear, lastMonth, 1)),
        endDate: fmt(new Date(lastMonthYear, lastMonth, daysInLastMonth)),
      }
    }
    default:
      return { startDate: fmt(new Date(year, month, 1)), endDate: fmt(today) }
  }
}

// Tab definitions
const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'categories', label: 'Theo danh mục' },
  { id: 'trend', label: 'Xu hướng' },
  { id: 'annual', label: 'Báo cáo năm' },
]

// Month selector for overview tab
function MonthSelector({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <select
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }}
      >
        {months.map((m) => (
          <option key={m} value={m}>Tháng {m}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}

// Period Filter Component
function PeriodFilter({ value, onChange }: { value: DateFilterPreset; onChange: (v: DateFilterPreset) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {PERIOD_PRESETS.map((preset) => (
        <button
          key={preset.value}
          onClick={() => onChange(preset.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: value === preset.value ? '1px solid #4f46e5' : '1px solid #e2e8f0',
            background: value === preset.value ? '#eef2ff' : '#fff',
            color: value === preset.value ? '#4f46e5' : '#64748b',
            fontSize: '13px',
            fontWeight: value === preset.value ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

// Overview Tab
function OverviewTab() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const { data, isLoading } = useMonthlyOverview(year, month)
  const { overview, comparison } = data || {}

  const savingsRate = overview && overview.totalIncome > 0
    ? Math.round((overview.difference / overview.totalIncome) * 100)
    : 0

  if (isLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Tổng quan tháng</h3>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {/* 3 Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Income Card */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Tổng thu</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>
            {formatCurrency(overview?.totalIncome || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {overview?.incomeCount || 0} giao dịch
            {comparison?.incomeChangePercent !== null && comparison?.incomeChangePercent !== undefined && (
              <span style={{ marginLeft: '8px', color: comparison.incomeChangePercent >= 0 ? '#16a34a' : '#dc2626' }}>
                {comparison.incomeChangePercent >= 0 ? '↑' : '↓'} {Math.abs(comparison.incomeChangePercent)}%
              </span>
            )}
          </div>
        </div>

        {/* Expense Card */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Tổng chi</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>
            {formatCurrency(overview?.totalExpense || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {overview?.expenseCount || 0} giao dịch
            {comparison?.expenseChangePercent !== null && comparison?.expenseChangePercent !== undefined && (
              <span style={{ marginLeft: '8px', color: comparison.expenseChangePercent <= 0 ? '#16a34a' : '#dc2626' }}>
                {comparison.expenseChangePercent >= 0 ? '↑' : '↓'} {Math.abs(comparison.expenseChangePercent)}%
              </span>
            )}
          </div>
        </div>

        {/* Savings Card */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Tiết kiệm</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: overview?.difference && overview.difference >= 0 ? '#2563eb' : '#dc2626', marginBottom: '4px' }}>
            {formatCurrency(overview?.difference || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {savingsRate}% tỷ lệ
          </div>
        </div>
      </div>
    </div>
  )
}

// Categories Tab
function CategoriesTab() {
  const [period, setPeriod] = useState<DateFilterPreset>('this_month')
  const { startDate, endDate } = getDateRangeFromPreset(period)

  const { data: categories, isLoading } = useExpensesByCategory(startDate, endDate)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data: transactions } = useTransactionsByCategory(
    selectedCategory || '',
    startDate,
    endDate
  )

  if (isLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Chi tiêu theo danh mục</h3>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Categories List */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontSize: '13px', color: '#64748b' }}>Danh mục</th>
                <th style={{ textAlign: 'right', padding: '8px', fontSize: '13px', color: '#64748b' }}>Số tiền</th>
                <th style={{ textAlign: 'right', padding: '8px', fontSize: '13px', color: '#64748b' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((cat) => (
                <tr
                  key={cat.categoryId}
                  onClick={() => setSelectedCategory(cat.categoryId)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                >
                  <td style={{ padding: '12px 8px', fontSize: '14px' }}>
                    {cat.categoryIcon && <span style={{ marginRight: '8px' }}>{cat.categoryIcon}</span>}
                    {cat.categoryName}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px', textAlign: 'right' }}>
                    {formatCurrency(cat.totalAmount)}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px', textAlign: 'right', color: '#64748b' }}>
                    {cat.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Category Details (Drill-down) */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          {selectedCategory && transactions ? (
            <>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
                Chi tiết: {categories?.find(c => c.categoryId === selectedCategory)?.categoryName}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#64748b' }}>Ngày</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#64748b' }}>Số tiền</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#64748b' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions as unknown[]).slice(0, 10).map((t: any) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontSize: '13px' }}>{t.date}</td>
                      <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', color: '#dc2626' }}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>{t.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Nhấp vào danh mục để xem chi tiết
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Trend Tab
function TrendTab() {
  const [period, setPeriod] = useState<DateFilterPreset>('this_month')
  const { startDate, endDate } = getDateRangeFromPreset(period)

  const { data: trend, isLoading: trendLoading } = useIncomeExpenseTrend(undefined, startDate, endDate)
  const { data: topExpenses, isLoading: topLoading } = useTopExpenses(startDate, endDate, 10)

  if (trendLoading || topLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Xu hướng thu chi</h3>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Trend Chart Placeholder - would use Chart.js */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Biểu đồ xu hướng</h4>
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
          {trend && trend.length > 0 ? (
            <div style={{ width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Tháng</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#16a34a' }}>Thu</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#dc2626' }}>Chi</th>
                    <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>TB Chi</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.month} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontSize: '13px' }}>{t.month}</td>
                      <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', color: '#16a34a' }}>{formatCurrency(t.totalIncome)}</td>
                      <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(t.totalExpense)}</td>
                      <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', color: '#64748b' }}>{formatCurrency(t.averageExpense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            'Chưa có dữ liệu'
          )}
        </div>
      </div>

      {/* Top Expenses */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Top 10 chi tiêu lớn nhất</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>#</th>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Ngày</th>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Danh mục</th>
              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {(topExpenses as unknown[])?.slice(0, 10).map((t: any, i: number) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px', fontSize: '13px', fontWeight: i < 3 ? 600 : 400 }}>{i + 1}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{t.date}</td>
                <td style={{ padding: '8px', fontSize: '13px' }}>{t.category?.name || '-'}</td>
                <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Annual Tab
function AnnualTab() {
  const [year, setYear] = useState(new Date().getFullYear())

  const { data, isLoading } = useAnnualSummary(year)

  if (isLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải...</div>

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Báo cáo năm</h3>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }}
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Tổng thu</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{formatCurrency(data?.totalIncome || 0)}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Tổng chi</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(data?.totalExpense || 0)}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>TB thu/tháng</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(data?.averageIncome || 0)}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>TB chi/tháng</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(data?.averageExpense || 0)}</div>
        </div>
      </div>

      {/* Monthly Table */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>Tháng</th>
              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Thu</th>
              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Chi</th>
              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {data?.monthly.map((m) => (
              <tr key={m.month} style={{ borderBottom: '1px solid #f1f5f9', background: m.difference < 0 ? '#fef2f2' : 'transparent' }}>
                <td style={{ padding: '10px 8px', fontSize: '14px' }}>Tháng {parseInt(m.month.split('-')[1])}</td>
                <td style={{ padding: '10px 8px', fontSize: '14px', textAlign: 'right', color: '#16a34a' }}>{formatCurrency(m.income)}</td>
                <td style={{ padding: '10px 8px', fontSize: '14px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(m.expense)}</td>
                <td style={{ padding: '10px 8px', fontSize: '14px', textAlign: 'right', color: m.difference >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {formatCurrency(m.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Main Reports Page
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#4f46e5' : '#64748b',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'trend' && <TrendTab />}
      {activeTab === 'annual' && <AnnualTab />}
    </div>
  )
}
