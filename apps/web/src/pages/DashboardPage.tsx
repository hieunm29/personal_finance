import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS, type UserProfile } from '@pf/shared'
import { apiClient } from '../services/apiClient'
import { authClient } from '../lib/auth-client'
import { useDashboard } from '../hooks/useDashboard'
import { useNetWorth, useNetWorthHistory } from '../hooks/useAssets'
import { useBudgetProgress } from '../hooks/useBudget'
import { useTransaction } from '../hooks/useTransactions'
import { NetWorthOverview, FinancialHealthCard, DashboardKpis } from '../components/dashboard/DashboardOverview'
import MonthlyChart from '../components/dashboard/MonthlyChart'
import TopExpenseCategoriesList from '../components/dashboard/TopExpenseCategoriesList'
import RecentTransactionsList from '../components/dashboard/RecentTransactionsList'
import BudgetProgressCard from '../components/dashboard/BudgetProgressCard'
import DashboardInsights from '../components/dashboard/DashboardInsights'
import TransactionForm from '../components/transaction/TransactionForm'
import DashboardIcon from '../components/dashboard/DashboardIcon'
import MonthPicker from '../components/common/MonthPicker'
import './dashboard.css'

export default function DashboardPage() {
  const now = new Date()
  const currentMonth = now.toLocaleDateString('sv').slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [form, setForm] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const insightsRef = useRef<HTMLElement>(null)
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const { data: dashboardRes, isLoading, error, refetch } = useDashboard(month)
  const { data: profileRes } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
  })
  const { data: netWorthRes, isLoading: assetsLoading } = useNetWorth()
  const { data: historyRes } = useNetWorthHistory(13)
  const { data: budgetRes } = useBudgetProgress(month)
  const editingId = form && form !== 'create' ? form : null
  const { data: editRes, isLoading: editLoading, error: editError, refetch: refetchEdit } = useTransaction(editingId)
  const dashboard = dashboardRes?.data
  const currency = profileRes?.data?.currency ?? 'VND'
  const editTxn = editRes?.data
  const name = session?.user?.name?.trim().split(/\s+/).pop() ?? 'bạn'
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
  const monthLabel = `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`
  const hasInsights = dashboard && (
    dashboard.budgetProgress?.some(item => item.spent > item.limit || (item.limit > 0 && item.spent >= item.limit * 0.8 && item.spent < item.limit))
    || (dashboard.prevMonthExpense > 0 && dashboard.totalExpense !== dashboard.prevMonthExpense)
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (form && dialog && !dialog.open) dialog.showModal()
    else if (!form && dialog?.open) dialog.close()
  }, [form])

  function onTransactionSaved() {
    setForm(null)
    for (const queryKey of [QUERY_KEYS.dashboard, QUERY_KEYS.assets, QUERY_KEYS.budgetProgress]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  return (
    <div className="dashboard-page">
      <header className="db-topbar">
        <div className="db-greeting">
          <h1>{greeting}, {name}</h1>
          <p>{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · Còn {daysLeft} ngày nữa hết tháng</p>
        </div>
        <div className="db-actions">
          <MonthPicker
            value={month}
            onChange={setMonth}
            min="2000-01"
            max={currentMonth}
            triggerProps={{ className: 'db-button db-month-control', 'aria-label': `Chọn tháng báo cáo, đang xem ${monthLabel}` }}
          >
            <DashboardIcon name="calendar" /><span className="db-button-label">{monthLabel}</span>
          </MonthPicker>
          <button className="db-button db-icon-button" aria-label="Xem lưu ý tài chính" onClick={() => {
            insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            insightsRef.current?.focus({ preventScroll: true })
          }}><DashboardIcon name="bell" />{hasInsights ? <span className="db-notification-dot" /> : null}</button>
          <button className="db-button db-button-primary" aria-label="Thêm giao dịch" onClick={() => setForm('create')}><DashboardIcon name="plus" /><span className="db-button-label">Thêm giao dịch</span></button>
        </div>
      </header>

      <div className="db-content">
        {isLoading ? <div className="db-loading" role="status" aria-label="Đang tải Dashboard">{Array.from({ length: 6 }, (_, i) => <div className="db-skeleton" key={i} />)}</div> : error || !dashboard ? (
          <div className="db-card db-error" role="alert"><h2>Không thể tải Dashboard</h2><p>Vui lòng thử lại để xem dữ liệu tài chính của bạn.</p><button className="db-button" onClick={() => void refetch()}>Thử lại</button></div>
        ) : <>
          <section className="db-row db-row-hero" aria-label="Tổng quan tài chính">
            <NetWorthOverview netWorth={netWorthRes?.data} history={historyRes?.data} currency={currency} loading={assetsLoading} />
            <FinancialHealthCard dashboard={dashboard} budget={budgetRes?.data} month={month} currency={currency} />
          </section>
          <DashboardKpis dashboard={dashboard} month={month} currency={currency} />
          <section className="db-row db-row-chart" aria-label="Biểu đồ tài chính">
            <MonthlyChart data={dashboard.monthlyChart} currency={currency} />
            <TopExpenseCategoriesList categories={dashboard.topExpenseCategories} currency={currency} month={month} totalExpense={dashboard.totalExpense} />
          </section>
          <section className="db-row db-row-bottom" aria-label="Chi tiết tài chính">
            <BudgetProgressCard budgetProgress={dashboard.budgetProgress} currency={currency} month={month} progress={budgetRes?.data} />
            <RecentTransactionsList transactions={dashboard.recentTransactions} currency={currency} onEditTransaction={setForm} />
            <section ref={insightsRef} tabIndex={-1} className="db-insights-section" aria-label="Lưu ý tài chính"><DashboardInsights dashboard={dashboard} currency={currency} month={month} /></section>
          </section>
          <p className="db-footer">Personal Finance · Tổng quan tài chính của bạn</p>
        </>}
      </div>

      <dialog ref={dialogRef} className="db-transaction-dialog" aria-label={form === 'create' ? 'Thêm giao dịch' : 'Sửa giao dịch'} onCancel={() => setForm(null)} onClick={event => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setForm(null)
        }
      }}>
        {form === 'create' ? <TransactionForm mode="create" onSuccess={onTransactionSaved} onCancel={() => setForm(null)} /> : editTxn ? <TransactionForm key={editTxn.id} mode="edit" transactionId={editTxn.id} defaultValues={{
          type: editTxn.type as 'income' | 'expense', amount: editTxn.amount, categoryId: editTxn.categoryId, walletId: editTxn.assetId ? `asset-${editTxn.assetId}` : (editTxn.walletId ?? ''), date: editTxn.date, note: editTxn.note ?? '', isRecurring: editTxn.isRecurring, recurrenceInterval: editTxn.recurrenceInterval ?? undefined,
        }} onSuccess={onTransactionSaved} onCancel={() => setForm(null)} /> : editLoading ? <p role="status">Đang tải giao dịch…</p> : editError ? <div role="alert"><p>Không thể tải giao dịch.</p><button className="db-button" onClick={() => void refetchEdit()}>Thử lại</button><button className="db-button" onClick={() => setForm(null)}>Đóng</button></div> : null}
      </dialog>
    </div>
  )
}
