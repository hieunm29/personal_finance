import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type UserProfile } from '@pf/shared'
import { apiClient } from '../services/apiClient'
import { useBudget, useBudgetProgress, useBudgetHistory, useCopyPreviousBudget } from '../hooks/useBudget'
import { formatCurrency } from '../utils/format'
import { getPreviousMonth } from '../utils/date'
import BudgetFormModal from '../components/budget/BudgetFormModal'
import CategoryBudgetList from '../components/budget/CategoryBudgetList'
import BudgetChart from '../components/budget/BudgetChart'
import BudgetHistoryList from '../components/budget/BudgetHistoryList'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const primaryBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const secondaryBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#fff', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }

export default function BudgetPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [showModal, setShowModal] = useState(false)

  const previousMonth = getPreviousMonth(month)

  const { data: profileRes } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
  })
  const { data: budgetRes, isLoading } = useBudget(month)
  const { data: progressRes } = useBudgetProgress(month)
  const { data: prevBudgetRes } = useBudget(previousMonth, { enabled: !isLoading && budgetRes?.data === null })
  const { data: historyRes } = useBudgetHistory()
  const copyMutation = useCopyPreviousBudget()

  const currency = profileRes?.data?.currency ?? 'VND'
  const budget = budgetRes?.data ?? null
  const progress = progressRes?.data ?? null
  const prevBudget = prevBudgetRes?.data ?? null
  const history = historyRes?.data ?? []
  const isCopying = copyMutation.isPending

  const existingBudget = useMemo(
    () => budget ? { id: budget.id, totalLimit: budget.totalLimit, categoryBudgets: budget.categoryBudgets } : null,
    [budget],
  )

  function handleCopyPrevious() {
    if (!prevBudget) return
    copyMutation.mutate({ targetMonth: month })
  }

  const percentageColor =
    progress && progress.percentage >= 100
      ? '#dc2626'
      : progress && progress.percentage >= 80
        ? '#f59e0b'
        : '#16a34a'

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Ngân sách</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {budget && (
            <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>Sửa ngân sách</button>
          )}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: '80px', background: '#f1f5f9', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : budget === null ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', marginBottom: '16px' }}>Tháng này chưa có ngân sách</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>Tạo ngân sách</button>
            <button
              onClick={handleCopyPrevious}
              disabled={!prevBudget || isCopying}
              style={{ ...secondaryBtnStyle, opacity: !prevBudget || isCopying ? 0.5 : 1, cursor: !prevBudget || isCopying ? 'not-allowed' : 'pointer' }}
            >
              {isCopying ? 'Đang sao chép...' : 'Sao chép tháng trước'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Ngân sách tháng</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
                {formatCurrency(budget.totalLimit, currency)}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Đã chi</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>
                {formatCurrency(progress?.totalSpent ?? 0, currency)}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Còn lại</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(Math.max(0, progress?.remaining ?? budget.totalLimit), currency)}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Đã dùng %</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: percentageColor }}>
                {progress?.percentage ?? 0}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Chi tiết theo danh mục</h3>
              </div>
              <CategoryBudgetList
                categories={progress?.categories ?? []}
                currency={currency}
                onEdit={() => setShowModal(true)}
              />
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Ngân sách vs Thực tế</h3>
              <BudgetChart categories={progress?.categories ?? []} currency={currency} />
            </div>
          </div>
        </>
      )}

      {history.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', marginTop: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Lịch sử ngân sách</h3>
          <BudgetHistoryList history={history} onSelectMonth={(m) => setMonth(m)} />
        </div>
      )}

      <BudgetFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        month={month}
        existingBudget={existingBudget}
        currency={currency}
      />
    </div>
  )
}
