import { type MonthlyChartPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import './dashboard-details.css'

interface Props {
  data: MonthlyChartPoint[]
  currency: string
}

const CHART = { left: 48, right: 624, top: 16, bottom: 208 }
const BAR_WIDTH = 22

function axisLabel(value: number, currency: string): string {
  if (currency !== 'VND') return formatCurrency(value, currency)
  const amount = value / 100
  if (amount >= 1_000_000) return `${Math.round(amount / 1_000_000)}tr`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`
  return formatCurrency(value, currency)
}

function monthLabel(month: string): string {
  const [, monthNumber] = month.split('-')
  return `T${Number(monthNumber)}`
}

function monthName(month: string): string {
  const [, monthNumber] = month.split('-')
  return `Tháng ${Number(monthNumber)}`
}

export default function MonthlyChart({ data, currency }: Props) {
  if (data.length === 0) {
    return (
      <section className="db-card db-detail-chart" aria-label="Dòng tiền 6 tháng">
        <div className="db-card-head">
          <div>
            <h2 className="db-card-title">Dòng tiền 6 tháng</h2>
            <p className="db-card-sub">Chưa có dữ liệu dòng tiền</p>
          </div>
          <span className="db-detail-period">6T</span>
        </div>
        <div className="db-empty">Chưa có giao dịch trong 6 tháng gần đây</div>
      </section>
    )
  }

  const values = data.flatMap((point) => [point.income, point.expense, point.income - point.expense])
  const maxValue = Math.max(...values, 1)
  const minValue = Math.min(...values, 0)
  const chartMax = Math.ceil(maxValue / 4) * 4 || 4
  const chartMin = minValue < 0 ? Math.floor(minValue / 4) * 4 : 0
  const chartRange = chartMax - chartMin
  const chartHeight = CHART.bottom - CHART.top
  const xStep = (CHART.right - CHART.left) / Math.max(data.length, 1)
  const y = (value: number) => CHART.bottom - ((value - chartMin) / chartRange) * chartHeight
  const baseline = y(0)
  const x = (index: number) => CHART.left + xStep * (index + 0.5)
  const linePoints = data.map((point, index) => `${x(index)},${y(point.income - point.expense)}`).join(' ')
  const totalIncome = data.reduce((sum, point) => sum + point.income, 0)
  const totalExpense = data.reduce((sum, point) => sum + point.expense, 0)
  const averageNet = Math.round((totalIncome - totalExpense) / data.length)
  const latest = data[data.length - 1]

  return (
    <section className="db-card db-detail-chart" aria-label="Dòng tiền 6 tháng">
      <div className="db-card-head">
        <div>
          <h2 className="db-card-title">Dòng tiền 6 tháng</h2>
          <p className="db-card-sub">Thu nhập, chi tiêu và tiết kiệm · {data[0].month.split('-').reverse().join('/')} – {data[data.length - 1].month.split('-').reverse().join('/')}</p>
        </div>
        <span className="db-detail-period" aria-label="Khoảng thời gian 6 tháng">6T</span>
      </div>

      <div className="db-detail-legend" aria-label="Chú giải biểu đồ">
        <span><i className="db-swatch" style={{ background: '#10B981' }} />Thu nhập</span>
        <span><i className="db-swatch" style={{ background: '#F87171' }} />Chi tiêu</span>
        <span><i className="db-swatch db-swatch-dot" style={{ background: '#4F46E5' }} />Tiết kiệm (ròng)</span>
      </div>

      <div className="db-detail-chart-wrap">
        <svg viewBox="0 0 640 236" role="img" aria-label="Biểu đồ thu nhập, chi tiêu và tiết kiệm ròng sáu tháng">
          <g stroke="#EEF0F5">
            {[0, 1, 2, 3, 4].map((step) => {
              const gridY = CHART.top + (chartHeight / 4) * step
              return <line key={step} x1={CHART.left} x2={CHART.right} y1={gridY} y2={gridY} />
            })}
            <line x1={CHART.left} x2={CHART.right} y1={baseline} y2={baseline} stroke="#CBD5E1" />
          </g>
          <g className="db-detail-axis" textAnchor="end">
            {[0, 1, 2, 3, 4].map((step) => (
              <text key={step} x={CHART.left - 8} y={CHART.top + (chartHeight / 4) * step + 4}>
                {axisLabel(chartMax - (chartRange * step) / 4, currency)}
              </text>
            ))}
          </g>

          {data.map((point, index) => {
            const center = x(index)
            const incomeTop = y(point.income)
            const expenseTop = y(point.expense)
            const current = index === data.length - 1
            return (
              <g key={point.month}>
                <title>{`${monthName(point.month)}: Thu nhập ${formatCurrency(point.income, currency)}, chi tiêu ${formatCurrency(point.expense, currency)}, tiết kiệm ròng ${formatCurrency(point.income - point.expense, currency)}`}</title>
                {current && <rect x={center - xStep / 2 + 8} y={CHART.top - 6} width={Math.max(xStep - 16, 24)} height={CHART.bottom - CHART.top + 12} rx="8" fill="#4F46E5" opacity=".05" />}
                <rect x={center - BAR_WIDTH - 2} y={Math.min(incomeTop, baseline)} width={BAR_WIDTH} height={Math.abs(baseline - incomeTop)} rx="4" fill="#10B981" />
                <rect x={center + 2} y={Math.min(expenseTop, baseline)} width={BAR_WIDTH} height={Math.abs(baseline - expenseTop)} rx="4" fill="#F87171" />
                <text className="db-detail-axis" x={center} y="228" textAnchor="middle" style={current ? { fill: '#4F46E5', fontWeight: 600 } : undefined}>{monthLabel(point.month)}</text>
              </g>
            )
          })}

          <polyline points={linePoints} fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinejoin="round" />
          {data.map((point, index) => {
            const current = index === data.length - 1
            return <circle key={`${point.month}-net`} cx={x(index)} cy={y(point.income - point.expense)} r={current ? 5 : 4} fill={current ? '#4F46E5' : '#fff'} stroke="#4F46E5" strokeWidth="2" />
          })}
          <g transform={`translate(${Math.max(CHART.left + 4, x(data.length - 1) - 130)},${Math.max(CHART.top + 2, y(latest.income - latest.expense) - 52)})`} className="db-detail-tooltip">
            <rect width="124" height="40" rx="8" fill="#0F172A" />
            <text x="10" y="16">{monthName(latest.month)} · Tiết kiệm</text>
            <text x="10" y="32" className="db-detail-tooltip-value">{latest.income - latest.expense >= 0 ? '+' : ''}{formatCurrency(latest.income - latest.expense, currency)}</text>
          </g>
        </svg>
      </div>

      <div className="db-detail-summary num">
        <div>Tổng thu 6 tháng<strong>{formatCurrency(totalIncome, currency)}</strong></div>
        <div>Tổng chi 6 tháng<strong>{formatCurrency(totalExpense, currency)}</strong></div>
        <div>Tiết kiệm TB / tháng<strong className={averageNet >= 0 ? 'db-detail-positive' : 'db-detail-negative'}>{averageNet >= 0 ? '+' : ''}{formatCurrency(averageNet, currency)}</strong></div>
      </div>
    </section>
  )
}
