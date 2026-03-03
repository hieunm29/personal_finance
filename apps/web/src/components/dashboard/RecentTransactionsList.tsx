import { useNavigate } from 'react-router'
import { type TransactionWithRelations } from '@pf/shared'
import { formatCurrency, formatDate } from '../../utils/format'

interface Props {
  transactions: TransactionWithRelations[]
  currency: string
  onEditTransaction: (id: string) => void
}

export default function RecentTransactionsList({ transactions, currency, onEditTransaction }: Props) {
  const navigate = useNavigate()

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-800">Giao dịch gần đây</h3>
        <p className="text-center text-sm text-gray-400">
          Chưa có giao dịch.{' '}
          <button onClick={() => navigate('/transactions')} className="text-blue-500 underline">
            Thêm giao dịch đầu tiên →
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="font-semibold text-gray-800">Giao dịch gần đây</h3>
      </div>
      <ul className="divide-y divide-gray-50">
        {transactions.map((txn) => (
          <li
            key={txn.id}
            onClick={() => onEditTransaction(txn.id)}
            className="flex cursor-pointer items-center gap-3 px-6 py-3 hover:bg-gray-50"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: txn.category?.color ?? '#9ca3af' }}
            >
              {(txn.category?.name ?? '?')[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">
                {txn.category?.name ?? 'Không phân loại'}
              </p>
              {txn.note && <p className="truncate text-xs text-gray-400">{txn.note}</p>}
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${txn.type === 'income' ? 'text-green-600' : txn.type === 'transfer' ? 'text-gray-500' : 'text-red-600'}`}>
                {txn.type === 'income' ? '+' : txn.type === 'transfer' ? '' : '-'}{formatCurrency(txn.amount, currency)}
              </p>
              <p className="text-xs text-gray-400">{formatDate(txn.date)}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-gray-100 px-6 py-3 text-right">
        <button onClick={() => navigate('/transactions')} className="text-sm text-blue-500 hover:text-blue-700">
          Xem tất cả →
        </button>
      </div>
    </div>
  )
}
