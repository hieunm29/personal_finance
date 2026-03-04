import { useNavigate } from 'react-router'
import { type BudgetProgressItem } from '@pf/shared'
import { useBudgetProgress } from '../../hooks/useBudget'
import { formatCurrency } from '../../utils/format'

interface Props {
  budgetProgress: BudgetProgressItem[] | null
}

export default function BudgetProgressCard({ budgetProgress }: Props) {
  const navigate = useNavigate()
  const currentMonth = new Date().toLocaleDateString('sv').substring(0, 7)
  const { data: progressRes } = useBudgetProgress(currentMonth)
  const progress = progressRes?.data

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

  const pct = progress?.percentage ?? 0
  const warningBadge = pct >= 100
    ? <span style={{ color: '#dc2626', fontSize: '13px' }}>🔴 Đã vượt ngân sách ({pct}%)</span>
    : pct >= 80
      ? <span style={{ color: '#f59e0b', fontSize: '13px' }}>⚠ Gần đạt ngân sách ({pct}%)</span>
      : null

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Ngân sách tháng này</span>
        {warningBadge}
      </div>

      {budgetProgress.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Chưa có ngân sách theo danh mục</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {budgetProgress.map((item) => {
            const spent = item.spent
            const limit = item.limit
            const itemPct = limit > 0 ? Math.round(spent / limit * 100) : 0
            const barColor = itemPct >= 100 ? '#dc2626' : itemPct >= 80 ? '#f59e0b' : '#16a34a'
            return (
              <div key={item.categoryId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: '#374151' }}>{item.categoryName}</span>
                  <span style={{ color: itemPct >= 100 ? '#dc2626' : '#374151' }}>
                    {formatCurrency(spent)} / {formatCurrency(limit)}
                  </span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(itemPct, 100)}%`, height: '100%', background: barColor, borderRadius: '9999px', transition: 'all 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={() => navigate('/budget')} style={{ marginTop: '12px', fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        Xem chi tiết →
      </button>
    </div>
  )
}
