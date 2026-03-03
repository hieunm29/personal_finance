import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS, type UserProfile } from '@pf/shared'
import { apiClient } from '../services/apiClient'
import { useDashboard } from '../hooks/useDashboard'
import WalletBalanceCard from '../components/dashboard/WalletBalanceCard'
import MonthSummaryCards from '../components/dashboard/MonthSummaryCards'
import MonthlyChart from '../components/dashboard/MonthlyChart'
import TopExpenseCategoriesList from '../components/dashboard/TopExpenseCategoriesList'
import RecentTransactionsList from '../components/dashboard/RecentTransactionsList'
import BudgetProgressCard from '../components/dashboard/BudgetProgressCard'
import TransactionForm from '../components/transaction/TransactionForm'

const currentMonth = new Date().toLocaleDateString('sv').substring(0, 7)

export default function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editTxnId, setEditTxnId] = useState<string | null>(null)

  const { data: dashboardRes, isLoading: dashLoading } = useDashboard()
  const { data: profileRes } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
  })

  const dashboard = dashboardRes?.data
  const currency = profileRes?.data?.currency ?? 'VND'
  const editTxn = editTxnId ? dashboard?.recentTransactions.find((t) => t.id === editTxnId) : null

  if (dashLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!dashboard) return null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <WalletBalanceCard totalBalance={dashboard.totalBalance} currency={currency} />

      <MonthSummaryCards
        totalIncome={dashboard.totalIncome}
        totalExpense={dashboard.totalExpense}
        netAmount={dashboard.netAmount}
        prevMonthIncome={dashboard.prevMonthIncome}
        prevMonthExpense={dashboard.prevMonthExpense}
        currency={currency}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyChart data={dashboard.monthlyChart} currency={currency} />
        </div>
        <TopExpenseCategoriesList
          categories={dashboard.topExpenseCategories}
          currency={currency}
          month={currentMonth}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactionsList
            transactions={dashboard.recentTransactions}
            currency={currency}
            onEditTransaction={setEditTxnId}
          />
        </div>
        <BudgetProgressCard budgetProgress={dashboard.budgetProgress} />
      </div>

      {dashboard.netWorth === null && (
        <p
          className="cursor-pointer text-center text-sm text-gray-400 hover:text-gray-600"
          onClick={() => navigate('/assets')}
        >
          Thêm tài sản để theo dõi Net Worth →
        </p>
      )}

      {editTxnId && editTxn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditTxnId(null)}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <TransactionForm
              mode="edit"
              transactionId={editTxnId}
              defaultValues={{
                type: editTxn.type as 'income' | 'expense',
                amount: editTxn.amount,
                categoryId: editTxn.categoryId,
                walletId: editTxn.walletId,
                date: editTxn.date,
                note: editTxn.note ?? '',
              }}
              onSuccess={() => {
                setEditTxnId(null)
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard })
              }}
              onCancel={() => setEditTxnId(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
