import { useCallback, useMemo, useState } from 'react'
import type { TransactionFilter, TransactionWithRelations } from '@pf/shared'
import { useTransactions, useDeleteTransaction } from '../hooks/useTransactions'
import TransactionForm from '../components/transaction/TransactionForm'
import DeleteTransactionDialog from '../components/transaction/DeleteTransactionDialog'
import TransactionSearch from '../components/transaction/TransactionSearch'
import TransactionFilters from '../components/transaction/TransactionFilters'
import { formatCurrency, formatDate } from '../utils/format'

// ─── Helpers ─────────────────────────────────────────────────

function groupByDate(
  txns: TransactionWithRelations[],
): [string, TransactionWithRelations[]][] {
  const map = new Map<string, TransactionWithRelations[]>()
  for (const txn of txns) {
    if (!map.has(txn.date)) map.set(txn.date, [])
    map.get(txn.date)!.push(txn)
  }
  return Array.from(map.entries())
}

function countActiveFilters(f: TransactionFilter): number {
  let n = 0
  if (f.type) n++
  if (f.categoryId) n++
  if (f.dateFrom) n++
  if (f.dateTo) n++
  if (f.amountFrom !== undefined) n++
  if (f.amountTo !== undefined) n++
  return n
}

// ─── Category icon: colored circle + first letter ─────────────
function CategoryIcon({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color ?? '#6b7280' }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// ─── Transaction row ─────────────────────────────────────────
function TransactionRow({
  txn,
  onEdit,
  onDelete,
}: {
  txn: TransactionWithRelations
  onEdit: () => void
  onDelete: () => void
}) {
  const isIncome = txn.type === 'income'
  const amountStr = `${isIncome ? '+' : '−'} ${formatCurrency(txn.amount)}`
  const cat = txn.category as (typeof txn.category & { name: string; color: string | null }) | null

  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-center gap-3 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <CategoryIcon name={cat?.name ?? '?'} color={cat?.color ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{cat?.name ?? '—'}</p>
          <p className="text-xs text-gray-400">
            {(txn.wallet as { name: string } | null)?.name ?? '—'}
            {txn.note ? ` · ${txn.note}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            isIncome ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {amountStr}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Xóa giao dịch"
        className="shrink-0 rounded-md p-1.5 text-gray-300 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

// ─── Skeleton loader ─────────────────────────────────────────
function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────
function buildDefaultFilters(): TransactionFilter {
  const today = new Date()
  const dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('sv')
  const dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('sv')
  return { page: 1, limit: 20, dateFrom, dateTo }
}

const DEFAULT_FILTERS = buildDefaultFilters()

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilter>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTx, setEditTx] = useState<TransactionWithRelations | null>(null)
  const [deleteTx, setDeleteTx] = useState<TransactionWithRelations | null>(null)

  const { data, isLoading } = useTransactions(filters)
  const deleteMutation = useDeleteTransaction()

  const grouped = useMemo(() => groupByDate(data?.data ?? []), [data?.data])
  const meta = data?.meta
  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0
  const activeFilterCount = countActiveFilters(filters)

  const handleSearch = useCallback(
    (search: string) => setFilters((f) => ({ ...f, search: search || undefined, page: 1 })),
    [],
  )

  const handleFiltersChange = useCallback((next: TransactionFilter) => setFilters(next), [])

  const handleCreated = () => {
    setCreateModalOpen(false)
    setFilters(DEFAULT_FILTERS)
  }

  const handleUpdated = () => setEditTx(null)

  const handleDeleteConfirm = async () => {
    if (!deleteTx) return
    await deleteMutation.mutateAsync(deleteTx.id)
    setDeleteTx(null)
  }

  const page = filters.page ?? 1

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Giao dịch</h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <span className="text-base leading-none">+</span>
          <span>Giao dịch mới</span>
        </button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <TransactionSearch value={filters.search ?? ''} onSearch={handleSearch} />
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
          </svg>
          <span>Bộ lọc</span>
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <TransactionFilters filters={filters} onChange={handleFiltersChange} defaultFilters={DEFAULT_FILTERS} />
      )}

      {/* Summary bar */}
      {meta && (meta.totalIncome > 0 || meta.totalExpense > 0) && (
        <div className="flex gap-4 rounded-lg bg-white px-4 py-3 shadow-sm text-sm">
          <span className="text-gray-500">
            Thu: <span className="font-semibold text-green-600">{formatCurrency(meta.totalIncome)}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            Chi: <span className="font-semibold text-red-500">{formatCurrency(meta.totalExpense)}</span>
          </span>
          {meta.total > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-gray-400">{meta.total} giao dịch</span>
            </>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <SkeletonList />
      ) : isEmpty ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">
            {activeFilterCount > 0 || filters.search
              ? 'Không tìm thấy giao dịch nào phù hợp.'
              : 'Chưa có giao dịch nào. Nhấn + để thêm mới.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, txns]) => (
            <div key={date} className="overflow-hidden rounded-lg bg-white shadow-sm">
              {/* Date header */}
              <div className="border-b border-gray-50 bg-gray-50 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {formatDate(date)}
                </span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-gray-50 px-4">
                {txns.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onEdit={() => setEditTx(txn)}
                    onDelete={() => setDeleteTx(txn)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
          <button
            onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
            disabled={page === 1}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-sm text-gray-500">
            Trang {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setFilters((f) => ({ ...f, page: Math.min(meta.totalPages, (f.page ?? 1) + 1) }))}
            disabled={page === meta.totalPages}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tiếp →
          </button>
        </div>
      )}

      {/* Modal tạo giao dịch */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Thêm giao dịch mới">
        <TransactionForm
          mode="create"
          onSuccess={handleCreated}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      {/* Modal chỉnh sửa giao dịch */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Chỉnh sửa giao dịch">
        {editTx && (
          <TransactionForm
            mode="edit"
            transactionId={editTx.id}
            defaultValues={{
              type: editTx.type as 'income' | 'expense',
              amount: editTx.amount,
              categoryId: editTx.categoryId,
              walletId: editTx.walletId,
              date: editTx.date,
              note: editTx.note ?? '',
            }}
            onSuccess={handleUpdated}
            onCancel={() => setEditTx(null)}
          />
        )}
      </Modal>

      {/* Modal xác nhận xóa */}
      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Xóa giao dịch">
        <DeleteTransactionDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTx(null)}
          isPending={deleteMutation.isPending}
        />
      </Modal>
    </div>
  )
}
