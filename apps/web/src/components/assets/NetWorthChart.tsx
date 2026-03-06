import { useState } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { NetWorthHistoryPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const fmt = (v: number) => {
  const n = v / 100
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}

interface Props {
  data: NetWorthHistoryPoint[]
}

type Period = '6' | '12' | 'all'

export default function NetWorthChart({ data }: Props) {
  const [period, setPeriod] = useState<Period>('12')

  const sliced =
    period === '6' ? data.slice(-6) : period === '12' ? data.slice(-12) : data

  if (sliced.length < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['6', '12', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                background: period === p ? '#4f46e5' : '#fff',
                color: period === p ? '#fff' : '#64748b',
                fontWeight: period === p ? 600 : 400,
              }}
            >
              {p === '6' ? '6 tháng' : p === '12' ? '12 tháng' : 'Tất cả'}
            </button>
          ))}
        </div>
        <div
          style={{
            height: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '14px',
          }}
        >
          Chưa đủ dữ liệu để hiển thị biểu đồ
        </div>
      </div>
    )
  }

  const labels = sliced.map((p) => {
    const [year, month] = p.month.split('-')
    return `${month}/${year}`
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Net Worth',
        data: sliced.map((p) => p.netWorth),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79,70,229,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#4f46e5',
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
        ticks: { font: { size: 11 }, color: '#94a3b8' },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['6', '12', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: 'pointer',
              background: period === p ? '#4f46e5' : '#fff',
              color: period === p ? '#fff' : '#64748b',
              fontWeight: period === p ? 600 : 400,
            }}
          >
            {p === '6' ? '6 tháng' : p === '12' ? '12 tháng' : 'Tất cả'}
          </button>
        ))}
      </div>
      <div style={{ height: '220px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
