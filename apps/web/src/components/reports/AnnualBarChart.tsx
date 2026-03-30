import './chartSetup'
import { Bar } from 'react-chartjs-2'
import type { AnnualSummaryItem } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

const fmt = (v: number) => {
  const n = v / 100
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}

interface Props {
  data: AnnualSummaryItem[]
}

export default function AnnualBarChart({ data }: Props) {
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
        Chưa có dữ liệu
      </div>
    )
  }

  const labels = data.map((item) => {
    const [, month] = item.month.split('-')
    return `T${month}`
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Thu',
        data: data.map((item) => item.income),
        backgroundColor: '#16a34a',
      },
      {
        label: 'Chi',
        data: data.map((item) => item.expense),
        backgroundColor: '#dc2626',
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
          title: (items: { dataIndex: number }[]) =>
            `Tháng ${data[items[0].dataIndex].month.split('-')[1]}`,
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
      <Bar data={chartData} options={options} />
    </div>
  )
}
