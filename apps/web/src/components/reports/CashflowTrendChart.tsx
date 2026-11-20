import './chartSetup'
import { useId, useMemo, useState } from 'react'
import { BarController, Chart as ChartJS, LineController } from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import type { TrendDataPoint } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

ChartJS.register(BarController, LineController)

const compactAmount = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const rate = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

function formatRate(value: number) {
  return `${rate.format(value)}%`
}

function getChartOptions(currency: string): ChartOptions<'bar' | 'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ({ dataset, parsed }) => {
            const value = parsed.y
            if (value === null) return ''
            return dataset.yAxisID === 'rate'
              ? `${dataset.label}: ${formatRate(value)}`
              : `${dataset.label}: ${formatCurrency(value, currency)}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { autoSkip: false, color: '#64748b' } },
      amount: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        grid: { color: '#e9edf4' },
        ticks: { color: '#64748b', maxTicksLimit: 5, callback: (value) => compactAmount.format(Number(value) / 100) },
      },
      rate: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { color: '#64748b', maxTicksLimit: 5, callback: (value) => formatRate(Number(value)) },
      },
    },
  }
}

export default function CashflowTrendChart({ data, currency }: { data: TrendDataPoint[]; currency: string }) {
  const [expanded, setExpanded] = useState(false)
  const tableId = useId()
  const options = useMemo(() => getChartOptions(currency), [currency])
  const chartData: ChartData<'bar' | 'line', (number | null)[], string> = {
    labels: data.map(({ month }) => `T${Number(month.slice(5))}`),
    datasets: [
      {
        type: 'line',
        label: 'Tỷ lệ tiết kiệm',
        data: data.map(({ savingsRate }) => savingsRate),
        yAxisID: 'rate',
        borderColor: '#c65d00',
        backgroundColor: '#c65d00',
        borderDash: [4, 4],
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        type: 'bar',
        label: 'Thu',
        data: data.map(({ totalIncome }) => totalIncome),
        yAxisID: 'amount',
        backgroundColor: '#10b981',
        borderRadius: 4,
        maxBarThickness: 22,
        order: 1,
      },
      {
        type: 'bar',
        label: 'Chi',
        data: data.map(({ totalExpense }) => totalExpense),
        yAxisID: 'amount',
        backgroundColor: '#f87171',
        borderRadius: 4,
        maxBarThickness: 22,
        order: 1,
      },
    ],
  }

  return (
    <>
      <div className="reports-cashflow-chart">
        <Chart
          type="bar"
          data={chartData}
          options={options}
          role="img"
          aria-label="Tổng thu, tổng chi và tỷ lệ tiết kiệm theo tháng"
        />
      </div>
      <div className="reports-chart-data">
        <button type="button" className="reports-print-hide" aria-expanded={expanded}
          aria-controls={tableId} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Ẩn số liệu theo tháng' : 'Xem số liệu theo tháng'}
        </button>
        <table id={tableId} className={`report-table${expanded ? '' : ' reports-screen-hide'}`}>
          <caption className="sr-only">Dòng tiền theo tháng</caption>
          <thead>
            <tr>
              <th scope="col">Tháng</th>
              <th scope="col" className="report-table__align-right">Thu</th>
              <th scope="col" className="report-table__align-right">Chi</th>
              <th scope="col" className="report-table__align-right">Tỷ lệ tiết kiệm</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ month, totalIncome, totalExpense, savingsRate }) => (
              <tr key={month}>
                <th scope="row">{month.slice(5)}/{month.slice(0, 4)}</th>
                <td className="report-table__align-right">{formatCurrency(totalIncome, currency)}</td>
                <td className="report-table__align-right">{formatCurrency(totalExpense, currency)}</td>
                <td className="report-table__align-right">
                  {savingsRate === null ? 'Không có' : formatRate(savingsRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
