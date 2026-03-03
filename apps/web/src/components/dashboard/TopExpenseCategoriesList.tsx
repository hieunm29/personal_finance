import { useNavigate } from 'react-router'
import { type TopExpenseCategory } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

interface Props {
  categories: TopExpenseCategory[]
  currency: string
  month: string // YYYY-MM
}

export default function TopExpenseCategoriesList({ categories, currency, month }: Props) {
  const navigate = useNavigate()
  const [y, m] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const monthEnd = new Date(y, m, 0).toLocaleDateString('sv')

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-800">Top chi tiêu tháng</h3>
        <p className="text-center text-sm text-gray-400">Chưa có chi tiêu trong tháng này</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="font-semibold text-gray-800">Top chi tiêu tháng</h3>
      </div>
      <ul className="divide-y divide-gray-50">
        {categories.map((cat) => (
          <li
            key={cat.categoryId ?? 'null'}
            onClick={() => {
              const params = new URLSearchParams({ dateFrom: monthStart, dateTo: monthEnd })
              if (cat.categoryId) params.set('categoryId', cat.categoryId)
              navigate('/transactions?' + params)
            }}
            className="cursor-pointer px-6 py-3 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: cat.categoryColor ?? '#9ca3af' }}
              >
                {cat.categoryName[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-gray-800">{cat.categoryName}</p>
                  <div className="ml-2 flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-red-600">
                      {formatCurrency(cat.amount, currency)}
                    </span>
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
                <div className="mt-1 h-1 w-full rounded bg-gray-100">
                  <div
                    className="h-1 rounded bg-red-400"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
