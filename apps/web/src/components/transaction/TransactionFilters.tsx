import type { TransactionFilter } from '@pf/shared'
import { useCategories } from '../../hooks/useCategories'

interface TransactionFiltersProps {
  filters: TransactionFilter
  onChange: (filters: TransactionFilter) => void
  defaultFilters?: TransactionFilter
}

// cents → VND display (e.g. 15000000 → "150.000")
function centsToDisplay(cents?: number): string {
  if (cents === undefined || cents === 0) return ''
  return Math.round(cents / 100).toLocaleString('vi-VN')
}

// raw VND string → cents (e.g. "150.000" → 15000000)
function displayToCents(raw: string): number | undefined {
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10)
  return isNaN(n) || n === 0 ? undefined : n * 100
}

const TYPE_OPTIONS = [
  { value: '' as const, label: 'Tất cả' },
  { value: 'expense' as const, label: 'Chi tiêu' },
  { value: 'income' as const, label: 'Thu nhập' },
]

export default function TransactionFilters({ filters, onChange, defaultFilters }: TransactionFiltersProps) {
  const filterType = filters.type === 'income' || filters.type === 'expense' ? filters.type : undefined
  const { data: categoriesData } = useCategories(filterType)

  const hasActiveFilters =
    filters.type ||
    filters.categoryId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.amountFrom !== undefined ||
    filters.amountTo !== undefined

  const reset = () =>
    onChange(defaultFilters ?? { page: 1, limit: filters.limit ?? 20 })

  const set = (patch: Partial<TransactionFilter>) =>
    onChange({ ...filters, ...patch, page: 1 })

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
      {/* Type */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-500">Loại giao dịch</p>
        <div className="flex overflow-hidden rounded-md border border-gray-200 text-sm">
          {TYPE_OPTIONS.map(({ value, label }) => {
            const active = (filters.type ?? '') === value
            const activeClass =
              value === 'expense'
                ? 'bg-red-500 text-white'
                : value === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-white'
            return (
              <button
                key={value}
                type="button"
                onClick={() => set({ type: value || undefined, categoryId: undefined })}
                className={`flex-1 py-1.5 font-medium transition-colors ${active ? activeClass : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Từ ngày</label>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Đến ngày</label>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Danh mục</label>
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) => set({ categoryId: e.target.value || undefined })}
          className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Tất cả danh mục</option>
          {categoriesData?.data.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Amount range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Từ số tiền (₫)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={centsToDisplay(filters.amountFrom)}
            onChange={(e) => set({ amountFrom: displayToCents(e.target.value) })}
            className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Đến số tiền (₫)</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="∞"
            value={centsToDisplay(filters.amountTo)}
            onChange={(e) => set({ amountTo: displayToCents(e.target.value) })}
            className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  )
}
