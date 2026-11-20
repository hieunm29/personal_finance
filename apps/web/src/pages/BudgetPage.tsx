import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type BudgetOverview, type UserProfile } from '@pf/shared'
import { useBudget, useBudgetOverview, useBudgetSuggestion, useUpsertBudget, useUpdateBudget } from '../hooks/useBudget'
import { useCategories } from '../hooks/useCategories'
import { apiClient } from '../services/apiClient'
import { formatCurrency } from '../utils/format'
import { getPreviousMonth } from '../utils/date'
import TransactionCategoryIcon from '../components/transaction/TransactionCategoryIcon'
import './budget.css'

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return `Tháng ${value}/${year}`
}

function nextMonth(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(year, value - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function currencyUnit(currency: string) {
  return currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₫'
}

function percent(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0
}

function ProgressBar({ value, total, tone = 'brand', striped = false }: { value: number; total: number; tone?: string; striped?: boolean }) {
  return <div className="budget-progress"><span className={`${tone} ${striped ? 'striped' : ''}`} style={{ width: `${percent(value, total)}%` }} /></div>
}

function StatCard({ icon, label, value, sub, tone = '' }: { icon: string; label: string; value: string; sub: string; tone?: string }) {
  return <div className="budget-stat"><span className={`budget-stat-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong className={tone}>{value}</strong><em>{sub}</em></div></div>
}

function BudgetSummary({ overview, currency }: { overview: BudgetOverview; currency: string }) {
  const statusLabel = overview.status === 'over' ? 'Vượt ngân sách' : overview.status === 'warning' ? 'Sắp vượt' : 'Đúng nhịp'
  const statusClass = overview.status === 'over' ? 'bad' : overview.status === 'warning' ? 'warn' : 'good'
  return <article className="budget-card budget-summary"><div className="budget-card-head"><div><h2>Ngân sách tháng {Number(overview.month.slice(5))}</h2><p>Tổng chi tiêu so với hạn mức</p></div><span className={`budget-badge ${statusClass}`}>◉ {statusLabel}</span></div><div className="budget-summary-total"><strong>{formatCurrency(overview.totalSpent, currency)}</strong><span>/ {formatCurrency(overview.budget?.totalLimit ?? 0, currency)} · đã dùng {overview.percentage}%</span></div><div className="budget-summary-bar"><ProgressBar value={overview.totalSpent} total={overview.budget?.totalLimit ?? 0} tone={statusClass === 'bad' ? 'bad' : statusClass === 'warn' ? 'warn' : 'brand'} /><i style={{ left: `${Math.min(100, overview.percentage)}%` }} /><small>Hôm nay · {overview.daysInMonth > 0 ? `${Math.min(100, Math.round(overview.daysElapsed / overview.daysInMonth * 100))}% tháng` : ''}</small><div><span>0</span><span>{formatCurrency((overview.budget?.totalLimit ?? 0) / 2, currency).replace(' ₫', 'tr')}</span><span>{formatCurrency(overview.budget?.totalLimit ?? 0, currency).replace(' ₫', 'tr')}</span></div></div><div className="budget-stat-grid"><StatCard icon="▣" label="Còn lại" value={formatCurrency(Math.max(0, overview.remaining), currency)} sub={`cho ${overview.daysRemaining} ngày`} tone="good" /><StatCard icon="▣" label="Được chi mỗi ngày" value={formatCurrency(Math.max(0, overview.dailyAllowance), currency)} sub={`TB đã chi ${formatCurrency(overview.averageDailySpend, currency)}/ngày`} /><StatCard icon="⌁" label="Dự kiến cuối tháng" value={formatCurrency(overview.projectedTotal, currency)} sub={overview.projectedOverage > 0 ? `vượt hạn mức ${formatCurrency(overview.projectedOverage, currency)}` : 'dưới hạn mức'} tone={overview.projectedOverage > 0 ? 'bad' : ''} /></div></article>
}

function AllocationCard({ overview, currency }: { overview: BudgetOverview; currency: string }) {
  const budgeted = overview.categories.filter((category) => category.limitAmount !== null).slice().sort((a, b) => (b.limitAmount ?? 0) - (a.limitAmount ?? 0))
  const total = overview.budget?.totalLimit ?? 0
  return <article className="budget-card budget-allocation"><div className="budget-card-head"><div><h2>Phân bổ theo danh mục</h2><p>{budgeted.length} danh mục có hạn mức</p></div></div><div className="budget-allocation-total"><strong>{formatCurrency(overview.allocatedAmount, currency)}</strong><span>/ {formatCurrency(total, currency)}</span></div><div className="budget-segmented">{budgeted.map((category) => <span key={category.categoryId} style={{ width: `${total > 0 ? Math.max(1, (category.limitAmount ?? 0) / total * 100) : 0}%`, backgroundColor: category.color ?? '#6366f1' }} />)}</div><div className="budget-allocation-list">{budgeted.slice(0, 6).map((category) => <div key={category.categoryId}><span><i style={{ backgroundColor: category.color ?? '#6366f1' }} />{category.name}</span><b>{formatCurrency(category.limitAmount ?? 0, currency).replace(' ₫', 'tr')}</b></div>)}</div>{overview.unallocatedAmount > 0 && <div className="budget-unallocated"><span>ⓘ</span><div><b>{formatCurrency(overview.unallocatedAmount, currency)} chưa phân bổ</b> — dùng cho các danh mục không đặt hạn mức.<br /><button type="button">Phân bổ thêm →</button></div></div>}</article>
}

type CategoryFilter = 'all' | 'warning' | 'over'

function CategoryBreakdown({ overview, currency, onEdit }: { overview: BudgetOverview; currency: string; onEdit: () => void }) {
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const rows = overview.categories.filter((category) => filter === 'all' || (filter === 'over' ? category.percentage >= 100 : category.percentage >= 80 && category.percentage < 100))
  return <article className="budget-card budget-categories"><div className="budget-card-head"><div><h2>Theo danh mục</h2><p>Sắp xếp theo mức độ cần chú ý</p></div><div className="budget-filters"><button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tất cả</button><button type="button" className={filter === 'warning' ? 'on warn' : ''} onClick={() => setFilter('warning')}>Sắp vượt <b>{overview.categories.filter((category) => category.percentage >= 80 && category.percentage < 100).length}</b></button><button type="button" className={filter === 'over' ? 'on bad' : ''} onClick={() => setFilter('over')}>Đã vượt <b>{overview.categories.filter((category) => category.percentage >= 100).length}</b></button></div></div>{rows.map((category) => { const over = category.percentage >= 100; const warning = category.percentage >= 80; const groupName = category.groupName ?? ''; return <div className="budget-category-row" key={category.categoryId}><div className="budget-category-top"><div className="budget-category-name"><span className="budget-category-icon" style={{ color: category.color ?? '#64748b', backgroundColor: `${category.color ?? '#64748b'}18` }}><TransactionCategoryIcon icon={category.icon} name={category.name} size={18} /></span><div><b>{category.name}</b><small>{groupName}</small></div></div><div className="budget-category-amount"><b>{formatCurrency(category.spent, currency)}</b><span>/ {formatCurrency(category.limitAmount ?? 0, currency)}</span><button type="button" aria-label={`Sửa hạn mức ${category.name}`} onClick={onEdit}>✎</button></div></div><ProgressBar value={category.spent} total={category.limitAmount ?? 0} tone={over ? 'bad' : warning ? 'warn' : 'good'} striped={over} /><div className={`budget-category-bottom ${over ? 'bad' : warning ? 'warn' : 'good'}`}><span>{over ? `⚠ Vượt ${formatCurrency(Math.abs(category.remaining ?? 0), currency)}` : category.remaining === 0 ? 'Đã dùng hết' : `Còn ${formatCurrency(category.remaining ?? 0, currency)}`}</span><b>{category.percentage}%</b></div></div>})}{overview.unbudgetedCategories.length > 0 && <button type="button" className="budget-unbudgeted" onClick={onEdit}><span>{overview.unbudgetedCategories.slice(0, 3).map((category) => <i key={category.categoryId} style={{ backgroundColor: `${category.color ?? '#6366f1'}22`, color: category.color ?? '#6366f1' }}><TransactionCategoryIcon icon={category.icon} size={14} /></i>)}</span><b>{overview.unbudgetedCategories.length} danh mục</b> chưa đặt hạn mức <strong>Đặt hạn mức →</strong></button>}</article>
}

function HistoryCard({ overview, currency, onSelectMonth }: { overview: BudgetOverview; currency: string; onSelectMonth: (month: string) => void }) {
  const history = overview.history.slice(0, 6).reverse()
  const max = Math.max(...history.map((item) => Math.max(item.totalLimit, item.totalSpent)), 1)
  return <article className="budget-card budget-history"><div className="budget-card-head"><div><h2>Lịch sử 6 tháng</h2><p>Ngân sách so với thực chi</p></div></div><div className="budget-legend"><span><i className="limit" />Ngân sách</span><span><i className="spent" />Thực chi</span><span><i className="over" />Vượt</span></div><div className="budget-chart" aria-label="Biểu đồ ngân sách sáu tháng">{history.map((item) => { const limitHeight = Math.max(4, item.totalLimit / max * 100); const spentHeight = Math.max(4, Math.min(100, item.totalSpent / max * 100)); return <button type="button" key={item.month} className="budget-chart-column" onClick={() => onSelectMonth(item.month)} aria-label={`${monthLabel(item.month)}: ${formatCurrency(item.totalSpent, currency)}`}><span><i style={{ height: `${limitHeight}%` }} /><i className={item.overage > 0 ? 'over' : ''} style={{ height: `${spentHeight}%` }} /></span><small>{item.month.slice(5) === overview.month.slice(5) ? 'T' + Number(item.month.slice(5)) : 'T' + Number(item.month.slice(5))}</small></button>})}</div><div className="budget-history-list">{overview.history.slice(0, 5).map((item, index) => <button type="button" key={item.month} className={item.month === overview.month ? 'current' : ''} onClick={() => onSelectMonth(item.month)}><div><b>{monthLabel(item.month)}</b><span>{formatCurrency(item.totalSpent, currency)} / {formatCurrency(item.totalLimit, currency)}</span></div><div className={item.overage > 0 ? 'bad' : 'good'}><b>{item.overage > 0 ? `Vượt ${formatCurrency(item.overage, currency)}` : `Dư ${formatCurrency(Math.abs(item.overage), currency)}`}</b><span>{item.totalLimit > 0 ? Math.round(item.totalSpent / item.totalLimit * 100) : 0}%</span></div></button>)}</div></article>
}

interface EditorProps { month: string; overview: BudgetOverview; currency: string; isOpen: boolean; mode: 'create' | 'suggested'; onClose: () => void; onSaved: () => void }

function BudgetEditor({ month, overview, currency, isOpen, mode, onClose, onSaved }: EditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [totalInput, setTotalInput] = useState('')
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({})
  const [copyPrevious, setCopyPrevious] = useState(false)
  const [error, setError] = useState('')
  const previousMonth = getPreviousMonth(month)
  const { data: previousBudgetRes } = useBudget(previousMonth)
  const { data: suggestionRes } = useBudgetSuggestion(month, isOpen && mode === 'suggested')
  const { data: categoriesRes } = useCategories('expense', true)
  const upsert = useUpsertBudget()
  const update = useUpdateBudget()
  const categories = (categoriesRes?.data ?? []).filter((category) => category.isVisible)
  const isPending = upsert.isPending || update.isPending
  const previousBudget = previousBudgetRes?.data ?? null
  const existing = overview.budget
  const totalCategoryLimit = Object.values(categoryInputs).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const total = Number(totalInput) || 0

  useEffect(() => {
    if (!isOpen) { if (dialogRef.current?.open) dialogRef.current.close(); return }
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    if (existing) {
      setTotalInput(String(existing.totalLimit / 100))
      setCategoryInputs(Object.fromEntries(existing.categoryBudgets.map((item) => [item.categoryId, String(item.limitAmount / 100)])))
      setCopyPrevious(false)
    } else if (mode === 'suggested' && suggestionRes?.data) {
      setTotalInput(String(suggestionRes.data.totalLimit / 100))
      setCategoryInputs(Object.fromEntries(suggestionRes.data.categories.map((item) => [item.categoryId, String(item.limitAmount / 100)])))
      setCopyPrevious(false)
    } else if (previousBudget) {
      setTotalInput(String(previousBudget.totalLimit / 100))
      setCategoryInputs(Object.fromEntries(previousBudget.categoryBudgets.map((item) => [item.categoryId, String(item.limitAmount / 100)])))
      setCopyPrevious(true)
    } else {
      setTotalInput(''); setCategoryInputs({}); setCopyPrevious(false)
    }
    setError('')
    return () => { if (dialog?.open) dialog.close() }
  }, [isOpen, month, mode, existing?.id, previousBudget?.id, suggestionRes?.data?.totalLimit])

  const save = async () => {
    if (total <= 0) { setError('Ngân sách tổng phải lớn hơn 0'); return }
    setError('')
    const categoriesPayload = Object.entries(categoryInputs).filter(([, value]) => Number(value) > 0).map(([categoryId, value]) => ({ categoryId, limitAmount: Math.round(Number(value) * 100) }))
    try {
      if (existing) await update.mutateAsync({ id: existing.id, data: { totalLimit: Math.round(total * 100), categories: categoriesPayload } })
      else await upsert.mutateAsync({ month, totalLimit: Math.round(total * 100), categories: categoriesPayload })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu ngân sách') }
  }

  return <dialog ref={dialogRef} className="budget-editor" onCancel={(event) => { event.preventDefault(); onClose() }} onClose={onClose}><div className="budget-editor-inner"><header><div><h2>{existing ? 'Chỉnh ngân sách' : 'Tạo ngân sách'}</h2><p>{monthLabel(month)}</p></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header><div className="budget-editor-body">{!existing && <div className="budget-copy-card"><span>▣</span><div><b>Sao chép từ {monthLabel(previousMonth).toLowerCase()}</b><small>Đã điền sẵn tổng ngân sách và hạn mức, bạn có thể sửa bên dưới</small></div><button type="button" className={`budget-switch ${copyPrevious ? 'on' : ''}`} role="switch" aria-checked={copyPrevious} onClick={() => { setCopyPrevious((value) => !value); if (!copyPrevious && previousBudget) { setTotalInput(String(previousBudget.totalLimit / 100)); setCategoryInputs(Object.fromEntries(previousBudget.categoryBudgets.map((item) => [item.categoryId, String(item.limitAmount / 100)]))) } }}><span /></button></div>}<label className="budget-editor-field"><span>Tổng ngân sách tháng <small>Bắt buộc</small></span><div><input type="number" min="0" step="1000" value={totalInput} onChange={(event) => { setTotalInput(event.target.value); setCopyPrevious(false) }} placeholder="15.000.000" /><b>{currencyUnit(currency)}</b></div></label><div className="budget-chips"><button type="button" onClick={() => previousBudget && (setTotalInput(String(previousBudget.totalLimit / 100)), setCopyPrevious(true))}>Như {monthLabel(previousMonth)} · {formatCurrency(previousBudget?.totalLimit ?? 0, currency)}</button><span>TB chi 3 tháng · {formatCurrency(0, currency)}</span></div><div className="budget-editor-field"><span>Hạn mức theo danh mục <small>Để trống = không giới hạn</small></span><div className="budget-editor-allocation"><div><b>Đã phân bổ {formatCurrency(totalCategoryLimit * 100, currency)}</b><strong>Còn {formatCurrency(Math.max(0, total - totalCategoryLimit) * 100, currency)}</strong></div><ProgressBar value={totalCategoryLimit} total={total} /><small>Hệ thống sẽ cảnh báo nếu tổng hạn mức vượt ngân sách.</small></div></div><div className="budget-editor-categories">{categories.map((category) => <div key={category.id}><div><span style={{ color: category.color ?? '#64748b', backgroundColor: `${category.color ?? '#64748b'}18` }}><TransactionCategoryIcon icon={category.icon} size={17} /></span><b>{category.name}</b><small>{category.group?.name ?? ''}</small></div><label><input type="number" min="0" step="1000" placeholder="Không giới hạn" value={categoryInputs[category.id] ?? ''} onChange={(event) => setCategoryInputs((values) => ({ ...values, [category.id]: event.target.value }))} /><em>{currencyUnit(currency)}</em></label></div>)}</div>{error && <p className="budget-editor-error">{error}</p>}</div><footer><span>Có thể chỉnh lại bất kỳ lúc nào trong tháng</span><button type="button" onClick={onClose}>Hủy</button><button type="button" className="budget-button primary" disabled={isPending || total <= 0} onClick={() => void save()}>{isPending ? 'Đang lưu...' : 'Lưu ngân sách'}</button></footer></div></dialog>
}

function EmptyBudget({ month, previousMonth, previousBudget, onCreate, onCopy, onSuggest, currency }: { month: string; previousMonth: string; previousBudget: BudgetOverview['budget']; onCreate: () => void; onCopy: () => void; onSuggest: () => void; currency: string }) {
  return <article className="budget-empty"><div className="budget-empty-icon">◎</div><h2>{monthLabel(month)} chưa có ngân sách</h2><p>Đặt hạn mức để biết mình còn được chi bao nhiêu và nhận cảnh báo trước khi vượt.</p><div className="budget-empty-options"><button type="button" className="recommended" onClick={onCopy} disabled={!previousBudget}><span>▣</span><b>Sao chép {monthLabel(previousMonth).toLowerCase()}</b><small>Dùng lại tổng ngân sách và hạn mức từng danh mục, chỉnh sửa trước khi lưu.</small><strong>{previousBudget ? `${formatCurrency(previousBudget.totalLimit, currency)} · ${previousBudget.categoryBudgets.length} hạn mức` : 'Chưa có ngân sách tháng trước'}</strong></button><button type="button" onClick={onSuggest}><span>✧</span><b>Tạo theo gợi ý</b><small>Đề xuất hạn mức dựa trên mức chi trung bình 3 tháng gần nhất.</small><strong>Dựa trên 3 tháng gần nhất</strong></button><button type="button" onClick={onCreate}><span>＋</span><b>Tạo từ đầu</b><small>Tự nhập tổng ngân sách và chọn danh mục cần giới hạn.</small><strong>Tùy chỉnh hoàn toàn</strong></button></div></article>
}

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'suggested'>('create')
  const { data: overviewRes, isLoading, error } = useBudgetOverview(month)
  const { data: previousBudgetRes } = useBudget(getPreviousMonth(month), { enabled: !isLoading && !overviewRes?.data?.budget })
  const { data: profileRes } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
  })
  const overview = overviewRes?.data
  const previousBudget = previousBudgetRes?.data ?? null
  const currency = profileRes?.data?.currency ?? 'VND'

  if (isLoading || !overview) return <div className="budget-page"><header className="budget-topbar"><div><h1>Ngân sách</h1><p>Đang tải dữ liệu ngân sách...</p></div></header><div className="budget-loading">{[1, 2, 3].map((item) => <div key={item} />)}</div></div>
  if (error) return <div className="budget-page"><header className="budget-topbar"><div><h1>Ngân sách</h1><p>Không thể tải dữ liệu</p></div></header><div className="budget-error">Có lỗi khi tải ngân sách. Vui lòng thử lại.</div></div>

  const openEditor = (mode: 'create' | 'suggested' = 'create') => { setEditorMode(mode); setEditorOpen(true) }
  return <div className="budget-page"><header className="budget-topbar"><div><h1>Ngân sách</h1><p>{overview.daysRemaining > 0 ? `Còn ${overview.daysRemaining} ngày nữa hết tháng` : 'Tháng đã kết thúc'} · cập nhật theo từng giao dịch</p></div><div className="budget-top-actions"><div className="budget-month-nav"><button type="button" aria-label="Tháng trước" onClick={() => setMonth(nextMonth(month, -1))}>‹</button><b>{monthLabel(month)}</b><button type="button" aria-label="Tháng sau" onClick={() => setMonth(nextMonth(month, 1))}>›</button></div><button type="button" className="budget-button primary" onClick={() => openEditor()} >✎ <span>{overview.budget ? 'Chỉnh ngân sách' : 'Tạo ngân sách'}</span></button></div></header><main className="budget-content">{!overview.budget ? <EmptyBudget month={month} previousMonth={getPreviousMonth(month)} previousBudget={previousBudget} onCreate={() => openEditor()} onCopy={() => openEditor()} onSuggest={() => openEditor('suggested')} currency={currency} /> : <><div className="budget-grid-top"><BudgetSummary overview={overview} currency={currency} /><AllocationCard overview={overview} currency={currency} /></div><div className="budget-grid-bottom"><CategoryBreakdown overview={overview} currency={currency} onEdit={() => openEditor()} /><HistoryCard overview={overview} currency={currency} onSelectMonth={setMonth} /></div></>}<p className="budget-footnote">Dữ liệu ngân sách được tính từ giao dịch đã ghi nhận. Hạn mức có thể chỉnh lại bất kỳ lúc nào.</p></main><BudgetEditor month={month} overview={overview} currency={currency} mode={editorMode} isOpen={editorOpen} onClose={() => setEditorOpen(false)} onSaved={() => setEditorOpen(false)} /></div>
}
