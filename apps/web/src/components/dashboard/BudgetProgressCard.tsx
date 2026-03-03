import { useNavigate } from 'react-router'
import { type BudgetProgressItem } from '@pf/shared'

interface Props {
  budgetProgress: BudgetProgressItem[] | null
}

export default function BudgetProgressCard({ budgetProgress }: Props) {
  const navigate = useNavigate()

  if (budgetProgress === null) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-3xl">💰</span>
          <div>
            <p className="font-medium text-gray-700">Thiết lập ngân sách tháng</p>
            <p className="mt-1 text-sm text-gray-400">Theo dõi chi tiêu theo danh mục</p>
          </div>
          <button
            onClick={() => navigate('/budget')}
            className="mt-1 rounded-lg bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600"
          >
            Thiết lập →
          </button>
        </div>
      </div>
    )
  }

  return null // Phase 2: implement budget progress bars
}
