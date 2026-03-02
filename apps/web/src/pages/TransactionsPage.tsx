import { useMemo, useState } from 'react'
import type { TransactionWithRelations } from '@pf/shared'
import { useTransactions } from '../hooks/useTransactions'
import TransactionForm from '../components/transaction/TransactionForm'
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
  onClick,
}: {
  txn: TransactionWithRelations
  onClick: () => void
}) {
  const isIncome = txn.type === 'income'
  const amountStr = `${isIncome ? '+' : '−'} ${formatCurrency(txn.amount)}`
  const cat = txn.category as (typeof txn.category & { name: string; color: string | null }) | null

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left hover:bg-gray-50 transition-colors"
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
export default function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTx, setEditTx] = useState<TransactionWithRelations | null>(null)

  const { data, isLoading } = useTransactions({ page, limit: 20 })

  const grouped = useMemo(() => groupByDate(data?.data ?? []), [data?.data])
  const meta = data?.meta
  const isEmpty = !isLoading && (data?.data.length ?? 0) === 0

  const handleCreated = () => {
    setCreateModalOpen(false)
    setPage(1) // reset về đầu sau khi tạo mới
  }

  const handleUpdated = () => {
    setEditTx(null)
  }

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
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <SkeletonList />
      ) : isEmpty ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Chưa có giao dịch nào. Nhấn + để thêm mới.</p>
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
                  <TransactionRow key={txn.id} txn={txn} onClick={() => setEditTx(txn)} />
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-sm text-gray-500">
            Trang {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
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
    </div>
  )
}
