import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { type MonthlyChartPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface Props {
  data: MonthlyChartPoint[]
  currency: string
}

export default function MonthlyChart({ data, currency }: Props) {
  const labels = data.map((d) => {
    const [y, m] = d.month.split('-')
    return `${m}/${y}`
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Thu nhập',
        data: data.map((d) => d.income / 100),
        backgroundColor: 'rgba(34,197,94,0.8)',
      },
      {
        label: 'Chi tiêu',
        data: data.map((d) => d.expense / 100),
        backgroundColor: 'rgba(239,68,68,0.8)',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: ${formatCurrency((ctx.raw as number) * 100, currency)}`,
        },
      },
    },
    scales: {
      y: {
        max:
          data.length === 0
            ? 10_000_000
            : Math.max(...data.map((d) => d.income / 100), ...data.map((d) => d.expense / 100)) +
              10_000_000,
        ticks: {
          callback: (v: unknown) => formatCurrency((v as number) * 100, currency),
        },
      },
    },
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-800">Biểu đồ thu chi 6 tháng</h3>
      <div className="relative h-64 md:h-80">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}
