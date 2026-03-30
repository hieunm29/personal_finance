import './chartSetup'
import { Line } from 'react-chartjs-2'
import type { TrendDataPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

const fmt = (v: number) => {
  const n = v / 100
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}

interface Props {
  data: TrendDataPoint[]
}

export default function TrendLineChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '14px',
        }}
      >
        Chưa đủ dữ liệu
      </div>
    )
  }

  const labels = data.map((p) => {
    const [, month] = p.month.split('-')
    return `T${month}`
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Thu',
        data: data.map((p) => p.totalIncome),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22,163,74,0.1)',
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#16a34a',
      },
      {
        label: 'Chi',
        data: data.map((p) => p.totalExpense),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220,38,38,0.1)',
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#dc2626',
      },
      {
        label: 'TB Chi',
        data: data.map((p) => p.averageExpense),
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.35,
        pointRadius: 0,
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
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.raw as number)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
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
    <div style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}
