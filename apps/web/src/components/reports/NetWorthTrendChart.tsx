import './chartSetup'
import { Line } from 'react-chartjs-2'
import type { NetWorthHistoryPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

interface Props {
  data: NetWorthHistoryPoint[]
}

export default function NetWorthTrendChart({ data }: Props) {
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
        Chưa có dữ liệu tài sản
      </div>
    )
  }

  const labels = data.map((p) => p.month)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Net Worth',
        data: data.map((p) => p.netWorth),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.2)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#3b82f6',
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
          label: (ctx: { raw: unknown }) => formatCurrency(ctx.raw as number),
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
          callback: (value: unknown) => formatCurrency(value as number),
        },
      },
    },
  }

  return (
    <div style={{ height: '260px' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}
