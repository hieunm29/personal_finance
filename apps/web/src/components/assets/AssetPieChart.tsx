import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { AssetAllocationItem } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

ChartJS.register(ArcElement, Tooltip, Legend)

const TYPE_COLORS: Record<string, string> = {
  cash: '#4CAF50',
  bank: '#2196F3',
  gold: '#FFC107',
  stock: '#9C27B0',
  savings: '#00BCD4',
  real_estate: '#FF5722',
}

interface Props {
  data: AssetAllocationItem[]
}

export default function AssetPieChart({ data }: Props) {
  const filtered = data.filter((item) => item.totalValue > 0 && item.type !== 'debt')

  if (filtered.length === 0) {
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
        Chưa có tài sản để hiển thị
      </div>
    )
  }

  const chartData = {
    labels: filtered.map((item) => item.label),
    datasets: [
      {
        data: filtered.map((item) => item.totalValue),
        backgroundColor: filtered.map((item) => TYPE_COLORS[item.type] ?? '#94a3b8'),
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
            return `${ctx.label}: ${formatCurrency(value)} (${percentage}%)`
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
