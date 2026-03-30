import './chartSetup'
import { Bar } from 'react-chartjs-2'
import type { MonthlyOverview } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

const fmt = (v: number) => {
  const n = v / 100
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}

interface Props {
  data: MonthlyOverview
}

export default function IncomeExpenseBarChart({ data }: Props) {
  if (data.incomeCount === 0 && data.expenseCount === 0) {
    return (
      <div
        style={{
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '14px',
        }}
      >
        Không có dữ liệu
      </div>
    )
  }

  const chartData = {
    labels: ['Thu', 'Chi'],
    datasets: [
      {
        label: 'Thu',
        data: [data.totalIncome, 0],
        backgroundColor: '#16a34a',
      },
      {
        label: 'Chi',
        data: [0, data.totalExpense],
        backgroundColor: '#dc2626',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            ctx.dataset.label === 'Thu'
              ? `Thu: ${formatCurrency(ctx.raw as number)}`
              : `Chi: ${formatCurrency(ctx.raw as number)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 12 }, color: '#64748b' },
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          color: '#94a3b8',
          callback: (value: unknown) => fmt(value as number),
        },
      },
    },
  }

  return (
    <div style={{ height: '200px' }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}
