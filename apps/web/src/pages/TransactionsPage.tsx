import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type Asset, type CategoryType, type TransactionFilter, type TransactionWithRelations, type UserProfile, type Wallet } from '@pf/shared'
import { apiClient } from '../services/apiClient'
import {
  useDeleteTransaction,
  useExportTransactions,
  useInfiniteTransactions,
  useTransaction,
  useTransactionAnalytics,
} from '../hooks/useTransactions'
import { useAssets } from '../hooks/useAssets'
import { useBudgetProgress } from '../hooks/useBudget'
import { useCategories } from '../hooks/useCategories'
import { useWallets } from '../hooks/useWallets'
import TransactionForm from '../components/transaction/TransactionForm'
import TransactionCategoryIcon from '../components/transaction/TransactionCategoryIcon'
import DashboardIcon from '../components/dashboard/DashboardIcon'
import { formatCurrency, formatDate } from '../utils/format'
import './transactions.css'

const PAGE_SIZE = 8

type PageFilters = TransactionFilter & { walletIds?: string }

interface AnalyticsLike {
  totalIncome: number
  totalExpense: number
  incomeCount: number
  expenseCount: number
  netAmount: number
  prevNetAmount: number
  dailyExpenses: { date: string; amount: number }[]
  dailyTotals?: { date: string; income: number; expense: number; netAmount: number }[]
  categories: { categoryId: string | null; categoryName: string; categoryColor: string | null; categoryIcon: string | null; amount: number; percentage: number }[]
  total: number
}

interface WalletOption {
  id: string
  name: string
  kind: 'wallet' | 'asset'
  color?: string
}

function monthString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return { dateFrom: `${month}-01`, dateTo: new Date(year, monthNumber, 0).toLocaleDateString('sv') }
}

function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return !Number.isNaN(date.getTime()) && normalized === value
}

function buildDefaultFilters(month = monthString()): PageFilters {
  return { ...monthRange(month), page: 1, limit: PAGE_SIZE }
}

function parseInitialFilters(search: string): PageFilters {
  const params = new URLSearchParams(search)
  const initialDateFrom = params.get('dateFrom')
  const month = isIsoDate(initialDateFrom) ? initialDateFrom.slice(0, 7) : monthString()
  const filters: PageFilters = { ...buildDefaultFilters(month) }
  const stringKeys = ['type', 'categoryId', 'search', 'walletIds'] as const
  for (const key of stringKeys) {
    const value = params.get(key)
    if (value) (filters as Record<string, unknown>)[key] = value
  }
  if (isIsoDate(params.get('dateFrom'))) filters.dateFrom = params.get('dateFrom') as string
  if (isIsoDate(params.get('dateTo'))) filters.dateTo = params.get('dateTo') as string
  const amountFrom = params.get('amountFrom')
  const amountTo = params.get('amountTo')
  if (amountFrom && /^\d+$/.test(amountFrom)) filters.amountFrom = Number(amountFrom)
  if (amountTo && /^\d+$/.test(amountTo)) filters.amountTo = Number(amountTo)
  return filters
}

function getEnvelopeData<T>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object') return undefined
  if ('data' in value) return (value as { data?: T }).data
  return value as T
}

function TransactionIcon({ txn, size = 20 }: { txn: TransactionWithRelations; size?: number }) {
  if (!txn.category?.icon && txn.type === 'income') return <span aria-hidden="true">↓</span>
  if (!txn.category?.icon && txn.type === 'transfer') return <span aria-hidden="true">⇄</span>
  return <TransactionCategoryIcon icon={txn.category?.icon} name={txn.category?.name} size={size} color="currentColor" />
}

function dateHeading(date: string): string {
  const target = new Date(`${date}T00:00:00`)
  const now = new Date()
  const dayDiff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - target.getTime()) / 86_400_000)
  if (dayDiff === 0) return 'Hôm nay'
  if (dayDiff === 1) return 'Hôm qua'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(target)
}

function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function parseDisplayAmount(value: string): number | undefined {
  const parsed = Number(value.replace(/[^\d]/g, ''))
  return parsed > 0 ? parsed * 100 : undefined
}

function displayAmount(cents?: number): string {
  return cents ? Math.round(cents / 100).toLocaleString('vi-VN') : ''
}

function activeFilterCount(filters: PageFilters, month: string): number {
  let count = 0
  if (filters.type) count++
  if (filters.categoryId) count++
  if (filters.walletIds) count++
  if (filters.amountFrom !== undefined) count++
  if (filters.amountTo !== undefined) count++
  if (filters.dateFrom !== monthRange(month).dateFrom || filters.dateTo !== monthRange(month).dateTo) count++
  return count
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return <button type="button" className="tx-icon-button" aria-label={label} onClick={onClick}>{children}</button>
}

function StatCard({ tone, icon, label, value, footer }: { tone: string; icon: string; label: string; value: string; footer: React.ReactNode }) {
  return <article className="tx-stat-card"><div className={`tx-stat-icon ${tone}`}>{icon}</div><div className="tx-stat-label">{label}</div><div className={`tx-stat-value ${tone}`}>{value}</div><div className="tx-stat-footer">{footer}</div></article>
}

function DailyChart({ month, points, currency, onSelect }: { month: string; points: { date: string; amount: number }[]; currency: string; onSelect: (date: string) => void }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(year, monthNumber, 0).getDate()
  const byDate = new Map(points.map((point) => [point.date, point.amount]))
  const values = Array.from({ length: days }, (_, index) => byDate.get(`${month}-${String(index + 1).padStart(2, '0')}`) ?? 0)
  const max = Math.max(...values, 1)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNumber
  const highestIndex = values.indexOf(Math.max(...values))
  const highest = values[highestIndex] ?? 0
  return <article className="tx-daily-card">
    <div className="tx-card-head"><div><h2>Chi tiêu theo ngày</h2><p>Nhấn vào cột để lọc theo ngày</p></div>{highest > 0 && <span className="tx-badge neutral">Cao nhất: {String(highestIndex + 1).padStart(2, '0')}/{String(monthNumber).padStart(2, '0')} · {formatCurrency(highest, currency)}</span>}</div>
    <div className="tx-daily-bars" role="group" aria-label={`Biểu đồ chi tiêu từng ngày tháng ${monthNumber}`}>
      {values.map((amount, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`
        const future = isCurrentMonth && index + 1 > today.getDate()
        const isToday = isCurrentMonth && index + 1 === today.getDate()
        return <button key={date} type="button" className={`tx-daily-bar ${amount >= max * .75 ? 'big' : ''} ${future ? 'future' : ''} ${isToday ? 'today' : ''}`} style={{ height: `${Math.max((amount / max) * 100, amount ? 4 : 2)}%` }} aria-label={`${date}: ${formatCurrency(amount, currency)}`} onClick={() => onSelect(date)} />
      })}
    </div>
    <div className="tx-daily-axis"><span>01/{String(monthNumber).padStart(2, '0')}</span><span>10/{String(monthNumber).padStart(2, '0')}</span><span>20/{String(monthNumber).padStart(2, '0')}</span><span>{days}/{String(monthNumber).padStart(2, '0')}</span></div>
  </article>
}

function TransactionRow({ txn, currency, selected, onSelect, onEdit, onDelete }: { txn: TransactionWithRelations; currency: string; selected: boolean; onSelect: () => void; onEdit: () => void; onDelete: () => void }) {
  const isIncome = txn.type === 'income'
  const isTransfer = txn.type === 'transfer'
  const accountLabel = isTransfer ? `${txn.wallet?.name ?? txn.asset?.name ?? '—'} → ${txn.toWallet?.name ?? txn.toAsset?.name ?? '—'}` : txn.wallet?.name ?? txn.asset?.name ?? '—'
  return <div className={`tx-row ${selected ? 'selected' : ''}`}>
    <button type="button" className="tx-row-select" aria-current={selected ? 'true' : undefined} onClick={onSelect}>
    <span className={`tx-row-icon ${isIncome ? 'income' : isTransfer ? 'transfer' : 'expense'}`}><TransactionIcon txn={txn} /></span>
    <div className="tx-row-body"><div className="tx-row-name">{txn.note || txn.category?.name || 'Giao dịch'}</div><div className="tx-row-meta"><span>{txn.category?.name ?? 'Không phân loại'}</span><i /> <span>{accountLabel}</span>{txn.isRecurring && <span className="tx-tag">↻ Định kỳ</span>}</div></div>
    <span className={`tx-row-amount ${isIncome ? 'income' : isTransfer ? 'transfer' : ''}`}>{isIncome ? '+' : isTransfer ? '' : '−'}{formatCurrency(txn.amount, currency)}</span>
    </button>
    <div className="tx-row-actions">{!isTransfer && <IconButton label="Sửa" onClick={(event) => { event?.stopPropagation?.(); onEdit() }}>✎</IconButton>}<IconButton label="Xóa" onClick={(event) => { event?.stopPropagation?.(); onDelete() }}>⌫</IconButton></div>
  </div>
}

function Dialog({ open, title, onClose, children, className = '', bare = false }: { open: boolean; title?: string; onClose: () => void; children: React.ReactNode; className?: string; bare?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return
    if (!dialog.open) dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [open])
  if (!open) return null
  return <dialog ref={ref} className={`tx-dialog ${className}`} aria-label={title ?? 'Biểu mẫu giao dịch'} aria-labelledby={title && !bare ? 'tx-dialog-title' : undefined} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className={`tx-dialog-panel ${bare ? 'tx-dialog-panel-bare' : ''}`}>{bare ? children : <><header><h2 id="tx-dialog-title">{title}</h2><IconButton label="Đóng" onClick={onClose}>×</IconButton></header><div className="tx-dialog-body">{children}</div></>}</div>
  </dialog>
}

export default function TransactionsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filters, setFilters] = useState<PageFilters>(() => parseInitialFilters(location.search))
  const [month, setMonth] = useState(() => (parseInitialFilters(location.search).dateFrom ?? monthRange(monthString()).dateFrom).slice(0, 7))
  const [showFilters, setShowFilters] = useState(false)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(() => parseInitialFilters(location.search).search ?? '')
  const [createOpen, setCreateOpen] = useState(location.pathname === '/transactions/new')
  const [editTx, setEditTx] = useState<TransactionWithRelations | null>(null)
  const [deleteTx, setDeleteTx] = useState<TransactionWithRelations | null>(null)
  const updateFilters = useCallback((patch: Partial<PageFilters>) => setFilters((current) => ({ ...current, ...patch, page: 1 })), [])

  const queryFilters = filters as TransactionFilter
  const infinite = useInfiniteTransactions(queryFilters)
  const analyticsQuery = useTransactionAnalytics(queryFilters)
  const fullMonthAnalyticsQuery = useTransactionAnalytics({ ...filters, ...monthRange(month) } as TransactionFilter)
  const exportMutation = useExportTransactions()
  const deleteMutation = useDeleteTransaction()
  const { data: walletsData } = useWallets()
  const { data: assetsData } = useAssets()
  const categoryType = filters.type === 'income' || filters.type === 'expense' ? filters.type as CategoryType : undefined
  const { data: categoriesData } = useCategories(categoryType)
  const { data: profileData } = useQuery({ queryKey: QUERY_KEYS.profile, queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile') })
  const routeEditId = location.pathname.match(/^\/transactions\/([^/]+)\/edit$/)?.[1] ?? null
  const { data: routeEditData } = useTransaction(routeEditId)
  const transactions = useMemo(() => infinite.data?.pages.flatMap((page) => page.data) ?? [], [infinite.data])
  const lastPage = infinite.data?.pages[infinite.data.pages.length - 1]
  const meta = lastPage?.meta
  const analytics = getEnvelopeData<AnalyticsLike>(analyticsQuery.data)
  const fullMonthAnalytics = getEnvelopeData<AnalyticsLike>(fullMonthAnalyticsQuery.data)
  const currency = profileData?.data?.currency ?? 'VND'
  const options = useMemo<WalletOption[]>(() => [
    ...(walletsData?.data ?? []).map((wallet: Wallet) => ({ id: wallet.id, name: wallet.name, kind: 'wallet' as const })),
    ...(assetsData?.data ?? []).filter((asset: Asset) => asset.type === 'bank' || asset.type === 'cash').map((asset: Asset) => ({ id: `asset-${asset.id}`, name: asset.name, kind: 'asset' as const })),
  ], [walletsData?.data, assetsData?.data])
  const selectedWalletIds = useMemo(() => new Set((filters.walletIds ?? '').split(',').filter(Boolean)), [filters.walletIds])
  const selected = transactions.find((txn) => txn.id === selectedId) ?? (routeEditData?.data as TransactionWithRelations | undefined) ?? null
  const selectedMonth = (selected?.date ?? editTx?.date)?.slice(0, 7) ?? ''
  const { data: budgetProgressData } = useBudgetProgress(selectedMonth)
  const groups = useMemo(() => {
    const map = new Map<string, TransactionWithRelations[]>()
    for (const transaction of transactions) map.set(transaction.date, [...(map.get(transaction.date) ?? []), transaction])
    return Array.from(map.entries())
  }, [transactions])
  const filterCount = activeFilterCount(filters, month)

  const initialSelectionDone = useRef(false)

  useEffect(() => {
    const next = parseInitialFilters(location.search)
    setFilters(next)
    setMonth((next.dateFrom ?? monthRange(monthString()).dateFrom).slice(0, 7))
    setSearchInput(next.search ?? '')
    setSelectedId(null)
    setMobileDetailOpen(false)
    initialSelectionDone.current = false
  }, [location.search])

  useEffect(() => {
    setCreateOpen(location.pathname === '/transactions/new')
  }, [location.pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || target?.closest('dialog') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) return
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!initialSelectionDone.current && transactions[0]) {
      setSelectedId(transactions[0].id)
      initialSelectionDone.current = true
    }
  }, [transactions])

  useEffect(() => {
    const timer = window.setTimeout(() => updateFilters({ search: searchInput || undefined }), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput, updateFilters])

  useEffect(() => {
    if (routeEditId) setEditTx(routeEditData?.data as TransactionWithRelations | null)
  }, [routeEditId, routeEditData?.data])

  const setMonthFilter = (nextMonth: string) => { if (!/^\d{4}-\d{2}$/.test(nextMonth)) return; setMonth(nextMonth); updateFilters(monthRange(nextMonth)) }
  const clearFilters = () => { setSearchInput(''); setFilters(buildDefaultFilters(month)); setShowFilters(false) }
  const closeCreate = () => { setCreateOpen(false); if (location.pathname !== '/transactions') navigate(`/transactions${location.search}`, { replace: true }) }
  const closeEdit = () => { setEditTx(null); if (routeEditId) navigate(`/transactions${location.search}`, { replace: true }) }
  const handleDelete = async () => {
    if (!deleteTx) return
    try {
      await deleteMutation.mutateAsync(deleteTx.id)
      if (selectedId === deleteTx.id) { setSelectedId(null); setMobileDetailOpen(false) }
      setDeleteTx(null)
    } catch {
      // The mutation error is rendered in the confirmation dialog.
    }
  }
  const handleExport = async () => { try { await exportMutation.mutateAsync(queryFilters) } catch { /* rendered below */ } }
  const toggleWallet = (id: string) => { const next = new Set(selectedWalletIds); if (next.has(id)) next.delete(id); else next.add(id); updateFilters({ walletIds: Array.from(next).join(',') || undefined }) }
  const selectTransaction = (txn: TransactionWithRelations) => { setSelectedId(txn.id); setMobileDetailOpen(window.matchMedia('(max-width: 860px)').matches) }
  const dailyPoints = fullMonthAnalytics?.dailyExpenses ?? []
  const summaryIncome = analytics?.totalIncome ?? meta?.totalIncome ?? 0
  const summaryExpense = analytics?.totalExpense ?? meta?.totalExpense ?? 0
  const summaryNet = analytics?.netAmount ?? summaryIncome - summaryExpense
  const prevNet = analytics?.prevNetAmount ?? 0
  const summaryStart = new Date(`${filters.dateFrom ?? monthRange(month).dateFrom}T00:00:00`)
  const requestedEnd = new Date(`${filters.dateTo ?? monthRange(month).dateTo}T00:00:00`)
  const today = new Date(`${new Date().toLocaleDateString('sv')}T00:00:00`)
  const summaryEnd = requestedEnd > today && summaryStart <= today ? today : requestedEnd
  const summaryDays = Math.max(Math.round((summaryEnd.getTime() - summaryStart.getTime()) / 86_400_000) + 1, 1)

  const chips = [
    filters.search ? { key: 'search', label: `Tìm: ${filters.search}`, remove: () => setSearchInput('') } : null,
    filters.type ? { key: 'type', label: filters.type === 'income' ? 'Thu nhập' : filters.type === 'expense' ? 'Chi tiêu' : 'Chuyển khoản', remove: () => updateFilters({ type: undefined }) } : null,
    filters.categoryId ? { key: 'category', label: categoriesData?.data.find((category) => category.id === filters.categoryId)?.name ?? 'Danh mục', remove: () => updateFilters({ categoryId: undefined }) } : null,
    filters.walletIds ? { key: 'wallet', label: `Ví: ${Array.from(selectedWalletIds).map((id) => options.find((option) => option.id === id)?.name ?? id).join(', ')}`, remove: () => updateFilters({ walletIds: undefined }) } : null,
    filters.amountFrom !== undefined ? { key: 'amountFrom', label: `Từ ${formatCurrency(filters.amountFrom, currency)}`, remove: () => updateFilters({ amountFrom: undefined }) } : null,
    filters.amountTo !== undefined ? { key: 'amountTo', label: `Đến ${formatCurrency(filters.amountTo, currency)}`, remove: () => updateFilters({ amountTo: undefined }) } : null,
    (filters.dateFrom !== monthRange(month).dateFrom || filters.dateTo !== monthRange(month).dateTo) ? { key: 'date', label: `${filters.dateFrom ?? '…'} – ${filters.dateTo ?? '…'}`, remove: () => updateFilters(monthRange(month)) } : null,
  ].filter(Boolean) as { key: string; label: string; remove: () => void }[]

  return <div className="tx-page">
    <header className="tx-page-header"><div><h1>Giao dịch</h1><p>Ghi nhận, tìm kiếm và quản lý mọi khoản thu chi</p></div><div className="tx-page-actions"><label className="tx-month-select" data-month={`Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`}><DashboardIcon name="calendar" size={17} /><span className="sr-only">Tháng đang xem</span><input type="month" value={month} onChange={(event) => setMonthFilter(event.target.value)} aria-label="Chọn tháng" /><span aria-hidden="true">⌄</span></label><button type="button" className="tx-button" onClick={handleExport} disabled={exportMutation.isPending}>⇩ <span>{exportMutation.isPending ? 'Đang xuất…' : 'Xuất'}</span></button><button type="button" className="tx-button primary" onClick={() => setCreateOpen(true)}><DashboardIcon name="plus" size={17} /><span>Thêm giao dịch</span></button></div></header>

    <section className="tx-summary" aria-label="Tổng hợp">
      <StatCard tone="income" icon="↓" label="Tổng thu" value={`+${formatCurrency(summaryIncome, currency)}`} footer={`${analytics?.incomeCount ?? '—'} giao dịch`} />
      <StatCard tone="expense" icon="↑" label="Tổng chi" value={`−${formatCurrency(summaryExpense, currency)}`} footer={`${analytics?.expenseCount ?? '—'} giao dịch · TB ${summaryExpense ? formatCurrency(Math.round(summaryExpense / Math.max(summaryDays, 1)), currency) : formatCurrency(0, currency)}/ngày`} />
      <StatCard tone="net" icon="⚖" label="Chênh lệch" value={`${summaryNet >= 0 ? '+' : '−'}${formatCurrency(Math.abs(summaryNet), currency)}`} footer={<><span className={`tx-change ${summaryNet >= prevNet ? 'good' : 'bad'}`}>{summaryNet >= prevNet ? '↗' : '↘'} {prevNet ? `${Math.abs(((summaryNet - prevNet) / Math.abs(prevNet)) * 100).toFixed(1)}%` : '—'}</span> so với kỳ trước</>} />
      <DailyChart month={month} points={dailyPoints} currency={currency} onSelect={(date) => updateFilters({ dateFrom: date, dateTo: date })} />
    </section>
    {(analyticsQuery.isError || fullMonthAnalyticsQuery.isError) && <div className="tx-error-state tx-analytics-error"><p>Không thể tải số liệu phân tích.</p><button type="button" className="tx-button" onClick={() => { void analyticsQuery.refetch(); void fullMonthAnalyticsQuery.refetch() }}>Thử lại</button></div>}

    <section className="tx-filter-card" aria-label="Tìm kiếm và bộ lọc"><div className="tx-toolbar"><div className="tx-search"><span aria-hidden="true">⌕</span><input ref={searchInputRef} type="search" value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} placeholder="Tìm theo ghi chú, danh mục, số tiền…" aria-label="Tìm kiếm giao dịch" /><kbd>/</kbd></div><div className="tx-segment" role="tablist" aria-label="Loại giao dịch">{(['', 'expense', 'income'] as const).map((type) => <button key={type || 'all'} type="button" role="tab" aria-selected={(filters.type ?? '') === type} className={(filters.type ?? '') === type ? 'on' : ''} onClick={() => updateFilters({ type: type || undefined, categoryId: undefined })}>{type === '' ? 'Tất cả' : type === 'expense' ? '● Chi tiêu' : '● Thu nhập'}</button>)}</div><button type="button" className={`tx-button filter ${showFilters || filterCount ? 'active' : ''}`} onClick={() => setShowFilters((value) => !value)}>⌯ Bộ lọc {filterCount > 0 && <span>{filterCount}</span>}</button></div>{showFilters && <div className="tx-filter-panel"><label><span>Danh mục</span><select value={filters.categoryId ?? ''} onChange={(event) => updateFilters({ categoryId: event.target.value || undefined })}><option value="">Tất cả danh mục</option>{categoriesData?.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="tx-wallet-field"><span>Ví / Tài khoản</span><button type="button" className="tx-select" onClick={() => setWalletMenuOpen((value) => !value)}>{selectedWalletIds.size ? `${selectedWalletIds.size} ví đã chọn` : 'Tất cả ví'} <span>⌄</span></button>{walletMenuOpen && <div className="tx-wallet-menu">{options.map((option) => <label key={option.id}><input type="checkbox" checked={selectedWalletIds.has(option.id)} onChange={() => toggleWallet(option.id)} />{option.name}<small>{option.kind === 'asset' ? 'Tài sản' : 'Ví'}</small></label>)}</div>}</div><label><span>Từ ngày</span><input type="date" value={filters.dateFrom ?? ''} onChange={(event) => updateFilters({ dateFrom: event.target.value || undefined })} /></label><label><span>Đến ngày</span><input type="date" value={filters.dateTo ?? ''} onChange={(event) => updateFilters({ dateTo: event.target.value || undefined })} /></label><label><span>Từ số tiền</span><input inputMode="numeric" value={displayAmount(filters.amountFrom)} onChange={(event) => updateFilters({ amountFrom: parseDisplayAmount(event.target.value) })} placeholder="0" /></label><label><span>Đến số tiền</span><input inputMode="numeric" value={displayAmount(filters.amountTo)} onChange={(event) => updateFilters({ amountTo: parseDisplayAmount(event.target.value) })} placeholder="∞" /></label></div>}<div className="tx-chips">{chips.map((chip) => <span className="tx-chip" key={chip.key}>{chip.label}<button type="button" onClick={chip.remove} aria-label={`Bỏ lọc ${chip.label}`}>×</button></span>)}{chips.length > 0 && <button type="button" className="tx-clear" onClick={clearFilters}>Xoá bộ lọc</button>}<span className="tx-result-count">Hiển thị <b>{analytics?.total ?? meta?.total ?? 0}</b> giao dịch</span></div></section>

    <section className="tx-split"><article className="tx-list-card" aria-label="Danh sách giao dịch">{infinite.isLoading ? <Skeleton /> : infinite.isError ? <div className="tx-error-state"><p>Không thể tải danh sách giao dịch.</p><button type="button" className="tx-button" onClick={() => infinite.refetch()}>Thử lại</button></div> : groups.length === 0 ? <div className="tx-empty">{filters.search || filterCount ? 'Không tìm thấy giao dịch nào phù hợp.' : 'Chưa có giao dịch nào. Nhấn “Thêm giao dịch” để bắt đầu.'}</div> : <>{groups.map(([date, rows]) => { const income = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0); const expense = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0); const net = analytics?.dailyTotals?.find(day => day.date === date)?.netAmount ?? income - expense; return <div className="tx-day" key={date}><div className="tx-day-head"><span><b>{dateHeading(date)}</b><small>{formatDate(date)}</small></span><strong className={net >= 0 ? 'income' : 'expense'}>{net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net), currency)}</strong></div>{rows.map((txn) => <TransactionRow key={txn.id} txn={txn} currency={currency} selected={selectedId === txn.id} onSelect={() => selectTransaction(txn)} onEdit={() => txn.type !== 'transfer' && setEditTx(txn)} onDelete={() => setDeleteTx(txn)} />)}</div>})}<div className="tx-list-foot"><span>Đang hiển thị {transactions.length} / {analytics?.total ?? meta?.total ?? transactions.length} giao dịch</span>{infinite.hasNextPage && <button type="button" className="tx-button" onClick={() => infinite.fetchNextPage()} disabled={infinite.isFetchingNextPage}>{infinite.isFetchingNextPage ? 'Đang tải…' : 'Tải thêm⌄'}</button>}</div></>}</article><aside className="tx-side"><TransactionDetail txn={selected} currency={currency} budget={budgetProgressData?.data ?? null} onClose={() => setSelectedId(null)} onEdit={() => selected && selected.type !== 'transfer' && setEditTx(selected)} onDelete={() => selected && setDeleteTx(selected)} onCategorySelect={() => selected?.categoryId && updateFilters({ categoryId: selected.categoryId })} /><CategorySummary categories={analytics?.categories ?? []} currency={currency} onSelect={(categoryId) => updateFilters({ categoryId })} /></aside></section>

    {selected && <Dialog open={mobileDetailOpen} title="Chi tiết giao dịch" onClose={() => setMobileDetailOpen(false)} className="tx-mobile-detail" bare><div className="tx-mobile-detail-panel"><TransactionDetail txn={selected} currency={currency} budget={budgetProgressData?.data ?? null} onClose={() => setMobileDetailOpen(false)} onEdit={() => selected.type !== 'transfer' && setEditTx(selected)} onDelete={() => setDeleteTx(selected)} onCategorySelect={() => selected.categoryId && updateFilters({ categoryId: selected.categoryId })} /></div></Dialog>}
    <button type="button" className="tx-fab" onClick={() => setCreateOpen(true)} aria-label="Thêm giao dịch">＋</button>

    <Dialog open={createOpen} onClose={closeCreate} className="tx-form-dialog" bare><TransactionForm mode="create" variant="redesigned" onSuccess={closeCreate} onSaveAndContinue={() => undefined} onCancel={closeCreate} /></Dialog>
    <Dialog open={!!editTx} onClose={closeEdit} className="tx-form-dialog" bare>{editTx && <TransactionForm mode="edit" variant="redesigned" transactionId={editTx.id} defaultValues={{ type: editTx.type as 'income' | 'expense', amount: editTx.amount, categoryId: editTx.categoryId, walletId: editTx.walletId ?? (editTx.assetId ? `asset-${editTx.assetId}` : ''), date: editTx.date, note: editTx.note ?? '', isRecurring: editTx.isRecurring, recurrenceInterval: editTx.recurrenceInterval ?? undefined }} onSuccess={closeEdit} onSaveAndContinue={() => undefined} onCancel={closeEdit} />}</Dialog>
    <Dialog open={!!deleteTx} title="Xóa giao dịch" onClose={() => !deleteMutation.isPending && setDeleteTx(null)} className="tx-delete-dialog"><p>Bạn có chắc muốn xóa giao dịch này? Hành động này không thể hoàn tác.</p>{deleteMutation.error && <p className="tx-error">{deleteMutation.error.message}</p>}<div className="tx-dialog-actions"><button type="button" className="tx-button" onClick={() => setDeleteTx(null)} disabled={deleteMutation.isPending}>Hủy</button><button type="button" className="tx-button danger" onClick={handleDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Đang xóa…' : 'Xóa'}</button></div></Dialog>
    {exportMutation.error && <p className="tx-error tx-export-error">{exportMutation.error.message}</p>}
  </div>
}

function Skeleton() { return <div className="tx-skeleton-list">{Array.from({ length: 6 }, (_, index) => <div key={index} className="tx-skeleton-row"><i /><span /><b /></div>)}</div> }

function CategorySummary({ categories, currency, onSelect }: { categories: AnalyticsLike['categories']; currency: string; onSelect: (categoryId: string) => void }) {
  if (categories.length === 0) return null
  return <article className="tx-category-summary"><div className="tx-card-head"><div><h2>Theo danh mục</h2><p>Trong kết quả đang lọc</p></div></div><ul>{categories.slice().sort((a, b) => b.amount - a.amount).map((category) => <li key={category.categoryId ?? `uncategorized-${category.categoryName}`}><button type="button" className="tx-category-summary-item" disabled={!category.categoryId} onClick={() => category.categoryId && onSelect(category.categoryId)} aria-label={category.categoryId ? `Lọc giao dịch theo ${category.categoryName}` : `${category.categoryName}, không thể lọc theo danh mục`}><span className="tx-category-summary-icon" style={{ color: category.categoryColor ?? '#64748b', background: `${category.categoryColor ?? '#94a3b8'}18` }}><TransactionCategoryIcon icon={category.categoryIcon} name={category.categoryName} size={17} /></span><span className="tx-category-summary-main"><strong>{category.categoryName}</strong><span className="tx-category-summary-bar"><i style={{ width: `${Math.min(Math.max(category.percentage, 0), 100)}%`, background: category.categoryColor ?? '#4f46e5' }} /></span></span><span className="tx-category-summary-value">{formatCurrency(category.amount, currency)}</span></button></li>)}</ul></article>
}

function TransactionDetail({ txn, currency, budget, onClose, onEdit, onDelete, onCategorySelect }: { txn: TransactionWithRelations | null; currency: string; budget: { categories?: { categoryId: string; category?: { name?: string; color?: string | null }; spent: number; limitAmount: number; percentage: number }[] } | null; onClose: () => void; onEdit: () => void; onDelete: () => void; onCategorySelect?: () => void }) {
  if (!txn) return <article className="tx-detail-card tx-detail-empty"><p>Chọn một giao dịch để xem chi tiết</p></article>
  const isIncome = txn.type === 'income'
  const isTransfer = txn.type === 'transfer'
  const accountLabel = isTransfer ? `${txn.wallet?.name ?? txn.asset?.name ?? '—'} → ${txn.toWallet?.name ?? txn.toAsset?.name ?? '—'}` : txn.wallet?.name ?? txn.asset?.name ?? '—'
  const budgetItem = budget?.categories?.find((item) => item.categoryId === txn.categoryId)
  return <article className="tx-detail-card" aria-label="Chi tiết giao dịch"><div className="tx-card-head"><h2>Chi tiết giao dịch</h2><IconButton label="Đóng chi tiết" onClick={onClose}>×</IconButton></div><div className="tx-detail-top"><span className={`tx-detail-icon ${isIncome ? 'income' : isTransfer ? 'transfer' : 'expense'}`}><TransactionIcon txn={txn} size={26} /></span><div><div className={`tx-detail-amount ${isIncome ? 'income' : isTransfer ? 'transfer' : 'expense'}`}>{isIncome ? '+' : isTransfer ? '' : '−'}{formatCurrency(txn.amount, currency)}</div><p>{txn.note || txn.category?.name || 'Giao dịch'}</p></div></div><dl className="tx-detail-list"><dt>Loại</dt><dd><span className={`tx-badge ${isIncome ? 'good' : isTransfer ? 'neutral' : 'bad'}`}>{isIncome ? 'Thu nhập' : isTransfer ? 'Chuyển khoản' : 'Chi tiêu'}</span></dd><dt>Danh mục</dt><dd><button type="button" className="tx-category-link" onClick={onCategorySelect}><i className="tx-color-dot" style={{ background: txn.category?.color ?? '#94a3b8' }} />{txn.category?.name ?? 'Không phân loại'}</button></dd><dt>Ví / Tài khoản</dt><dd>{accountLabel}</dd><dt>Ngày</dt><dd>{formatLongDate(txn.date)}</dd><dt>Ghi chú</dt><dd>{txn.note || '—'}</dd>{budgetItem && <><dt>Ngân sách</dt><dd className="tx-budget-detail"><div className="tx-progress"><span style={{ width: `${Math.min(budgetItem.percentage, 100)}%`, background: budgetItem.percentage >= 100 ? '#dc2626' : budgetItem.percentage >= 80 ? '#d97706' : '#059669' }} /></div><small>{budgetItem.category?.name ?? txn.category?.name} đã dùng {budgetItem.percentage}% ({formatCurrency(budgetItem.spent, currency)} / {formatCurrency(budgetItem.limitAmount, currency)})</small></dd></>}</dl>{!isTransfer && <div className="tx-detail-actions"><button type="button" className="tx-button" onClick={onEdit}>✎ Chỉnh sửa</button><button type="button" className="tx-button danger" onClick={onDelete}>⌫ Xóa</button></div>}{isTransfer && <div className="tx-detail-actions"><button type="button" className="tx-button danger" onClick={onDelete}>⌫ Xóa</button></div>}{!isTransfer && <div className="tx-note-box">ⓘ Không thể đổi loại thu ↔ chi. Hãy xoá và tạo giao dịch mới.</div>}</article>
}
