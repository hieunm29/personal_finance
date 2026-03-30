import './chartSetup'
import { Doughnut } from 'react-chartjs-2'
import type { CategoryExpense } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f59e0b', '#84cc16', '#d946ef',
]

interface Props {
  data: CategoryExpense[]
}

export default function CategoryPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: '260px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '14px',
        }}
      >
        Không có chi tiêu trong kỳ
      </div>
    )
  }

  const chartData = {
    labels: data.map((item) => `${item.categoryName} (${item.percentage.toFixed(1)}%)`),
    datasets: [
      {
        data: data.map((item) => item.totalAmount),
        backgroundColor: data.map((item, i) => item.categoryColor ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { size: 11 },
          padding: 12,
          boxWidth: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; raw: unknown; dataset: { data: unknown[] }; dataIndex: number }) => {
            const value = ctx.raw as number
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0)
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
            const item = data[ctx.dataIndex]
            return `${item.categoryName}: ${formatCurrency(value)} (${percentage}%)`
          },
        },
      },
    },
  }

  return (
    <div style={{ height: '260px' }}>
      <Doughnut data={chartData} options={options} />
    </div>
  )
}
