import './chartSetup'
import { Bar } from 'react-chartjs-2'
import type { BudgetComparisonItem } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

const fmt = (v: number) => {
  const n = v / 100
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}

interface Props {
  data: BudgetComparisonItem[]
}

export default function BudgetComparisonChart({ data }: Props) {
  if (data.length === 0) {
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
        Chưa có ngân sách cho tháng này
      </div>
    )
  }

  const chartData = {
    labels: data.map((item) => item.categoryName),
    datasets: [
      {
        label: 'Ngân sách',
        data: data.map((item) => item.budgetAmount),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Thực tế',
        data: data.map((item) => item.actualAmount),
        backgroundColor: data.map((item) =>
          item.actualAmount > item.budgetAmount ? '#dc2626' : '#16a34a',
        ),
      },
    ],
  }

  const options = {
    indexAxis: 'y' as const,
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
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.raw as number)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          color: '#94a3b8',
          callback: (value: unknown) => fmt(value as number),
        },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
      },
    },
  }

  return (
    <div style={{ height: `${Math.max(200, data.length * 40)}px` }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}
