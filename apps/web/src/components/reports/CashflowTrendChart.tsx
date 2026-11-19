import './chartSetup'
import { BarController, Chart as ChartJS, LineController } from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import type { TrendDataPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

ChartJS.register(BarController, LineController)

const compactAmount = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const rate = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

const options: ChartOptions<'bar' | 'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ({ dataset, parsed }) => {
          const value = parsed.y
          if (value === null) return ''
          return dataset.yAxisID === 'rate'
            ? `${dataset.label}: ${rate.format(value)}%`
            : `${dataset.label}: ${formatCurrency(value)}`
        },
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { autoSkip: false, color: '#64748b' } },
    amount: {
      type: 'linear',
      position: 'left',
      beginAtZero: true,
      grid: { color: '#e9edf4' },
      ticks: { color: '#64748b', maxTicksLimit: 5, callback: (value) => compactAmount.format(Number(value) / 100) },
    },
    rate: {
      type: 'linear',
      position: 'right',
      beginAtZero: true,
      grid: { drawOnChartArea: false },
      ticks: { color: '#64748b', maxTicksLimit: 5, callback: (value) => `${rate.format(Number(value))}%` },
    },
  },
}

export default function CashflowTrendChart({ data }: { data: TrendDataPoint[] }) {
  const chartData: ChartData<'bar' | 'line', (number | null)[], string> = {
    labels: data.map(({ month }) => `T${Number(month.slice(5))}`),
    datasets: [
      {
        type: 'line',
        label: 'Tỷ lệ tiết kiệm',
        data: data.map(({ savingsRate }) => savingsRate),
        yAxisID: 'rate',
        borderColor: '#c65d00',
        backgroundColor: '#c65d00',
        borderDash: [4, 4],
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        type: 'bar',
        label: 'Thu',
        data: data.map(({ totalIncome }) => totalIncome),
        yAxisID: 'amount',
        backgroundColor: '#10b981',
        borderRadius: 4,
        maxBarThickness: 22,
        order: 1,
      },
      {
        type: 'bar',
        label: 'Chi',
        data: data.map(({ totalExpense }) => totalExpense),
        yAxisID: 'amount',
        backgroundColor: '#f87171',
        borderRadius: 4,
        maxBarThickness: 22,
        order: 1,
      },
    ],
  }

  return (
    <div className="reports-cashflow-chart">
      <Chart
        type="bar"
        data={chartData}
        options={options}
        role="img"
        aria-label="Tổng thu, tổng chi và tỷ lệ tiết kiệm theo tháng"
      />
    </div>
  )
}
