import { formatCurrency } from '../../utils/format'

interface Props {
  totalIncome: number
  totalExpense: number
  netAmount: number
  prevMonthIncome: number
  prevMonthExpense: number
  currency: string
}

function pctChange(curr: number, prev: number): string | null {
  if (prev <= 0) return null
  return ((curr - prev) / prev * 100).toFixed(1)
}

function Badge({ pct, reverseColor }: { pct: string | null; reverseColor?: boolean }) {
  if (!pct) return <span className="text-xs text-gray-400">—</span>
  const num = parseFloat(pct)
  const up = num >= 0
  // reverseColor: for expense, up (more spending) = bad = red
  const isGood = reverseColor ? !up : up
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {up ? '↑' : '↓'}{Math.abs(num)}%
    </span>
  )
}

export default function MonthSummaryCards({ totalIncome, totalExpense, netAmount, prevMonthIncome, prevMonthExpense, currency }: Props) {
  const incomePct = pctChange(totalIncome, prevMonthIncome)
  const expensePct = pctChange(totalExpense, prevMonthExpense)
  const isPositive = netAmount >= 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-green-100 bg-green-50 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-green-700">Tổng thu</p>
          <Badge pct={incomePct} />
        </div>
        <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(totalIncome, currency)}</p>
      </div>

      <div className="rounded-xl border border-red-100 bg-red-50 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-red-700">Tổng chi</p>
          <Badge pct={expensePct} reverseColor />
        </div>
        <p className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(totalExpense, currency)}</p>
      </div>

      <div className={`rounded-xl border p-5 ${isPositive ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
        <p className="text-sm font-medium text-gray-600">Chênh lệch</p>
        <p className={`mt-2 text-2xl font-bold ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
          {isPositive ? '+' : '-'}{formatCurrency(Math.abs(netAmount), currency)}
        </p>
      </div>
    </div>
  )
}
