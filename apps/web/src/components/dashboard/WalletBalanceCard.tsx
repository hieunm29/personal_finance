import { formatCurrency } from '../../utils/format'

interface Props {
  totalAssets: number
  currency: string
}

export default function WalletBalanceCard({ totalAssets, currency }: Props) {
  const isPositive = totalAssets >= 0
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">Tổng tài sản</p>
      <p className="mt-1 text-xs text-gray-400">Tất cả tài sản đang có</p>
      <p className={`mt-3 text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(totalAssets, currency)}
      </p>
    </div>
  )
}
