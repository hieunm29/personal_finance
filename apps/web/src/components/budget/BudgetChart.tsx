import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import type { CategoryBudgetWithProgress } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

interface Props {
  categories: CategoryBudgetWithProgress[]
  currency?: string
}

export default function BudgetChart({ categories, currency = 'VND' }: Props) {
  const filtered = categories.filter((c) => c.limitAmount > 0)

  if (filtered.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Chưa đặt ngân sách theo danh mục để hiển thị biểu đồ</p>
  }

  const labels = filtered.map((c) => c.category.name)
  const budgetData = filtered.map((c) => c.limitAmount / 100)
  const spentData = filtered.map((c) => c.spent / 100)
  const spentColors = filtered.map((c) =>
    c.spent > c.limitAmount ? 'rgba(220, 38, 38, 0.7)' : 'rgba(22, 163, 74, 0.7)'
  )

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Ngân sách',
        data: budgetData,
        backgroundColor: 'rgba(79, 70, 229, 0.5)',
        borderColor: 'rgba(79, 70, 229, 0.8)',
        borderWidth: 1,
      },
      {
        label: 'Thực tế',
        data: spentData,
        backgroundColor: spentColors,
        borderColor: spentColors.map((c) => c.replace('0.7', '1')),
        borderWidth: 1,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label ?? ''}: ${formatCurrency(Math.round((ctx.parsed.x ?? 0) * 100), currency)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (v) => formatCurrency(Math.round((v as number) * 100), currency),
        },
      },
    },
  }

  return (
    <div style={{ height: `${Math.min(Math.max(200, filtered.length * 50), 600)}px`, position: 'relative' }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}
