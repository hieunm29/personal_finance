import { useEffect, useMemo, useRef } from 'react'
import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTransactionSchema, type CreateTransactionInput, type CategoryWithGroup } from '@pf/shared'
import { useCategories } from '../../hooks/useCategories'
import { useWallets } from '../../hooks/useWallets'
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions'

interface TransactionFormProps {
  mode: 'create' | 'edit'
  transactionId?: string
  defaultValues?: Partial<CreateTransactionInput>
  onSuccess?: () => void
  onCancel?: () => void
}

// ─── Amount input with VND formatting ───────────────────────
function AmountInput({
  control,
  error,
}: {
  control: ReturnType<typeof useForm<CreateTransactionInput>>['control']
  error?: string
}) {
  const { field } = useController({ name: 'amount', control })

  const displayValue = field.value > 0
    ? Math.round(field.value / 100).toLocaleString('vi-VN')
    : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    field.onChange(raw ? parseInt(raw, 10) * 100 : 0)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Số tiền <span className="text-gray-400">(₫)</span>
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onBlur={field.onBlur}
        placeholder="0"
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ─── Grouped category options ────────────────────────────────
function groupByGroup(categories: CategoryWithGroup[]) {
  const map = new Map<string, CategoryWithGroup[]>()
  for (const cat of categories) {
    // Drizzle leftJoin trả group có thể null nếu không tìm thấy
    const key = (cat.group as { name?: string } | null)?.name ?? 'Khác'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(cat)
  }
  return Array.from(map.entries())
}

// ─── Main form ───────────────────────────────────────────────
export default function TransactionForm({
  mode,
  transactionId,
  defaultValues,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const today = new Date().toLocaleDateString('sv') // 'sv' locale → YYYY-MM-DD theo local timezone

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      type: defaultValues?.type ?? 'expense',
      amount: defaultValues?.amount ?? 0,
      categoryId: defaultValues?.categoryId ?? '',
      walletId: defaultValues?.walletId ?? '',
      date: defaultValues?.date ?? today,
      note: defaultValues?.note ?? '',
      isRecurring: false,
    },
  })

  const selectedType = watch('type') as 'income' | 'expense'
  const prevTypeRef = useRef(selectedType)

  // Reset category khi đổi type (chỉ create mode)
  useEffect(() => {
    if (mode === 'create' && prevTypeRef.current !== selectedType) {
      setValue('categoryId', '')
      prevTypeRef.current = selectedType
    }
  }, [selectedType, mode, setValue])

  const { data: categoriesData, isLoading: catsLoading } = useCategories(selectedType)
  const { data: walletsData, isLoading: walletsLoading } = useWallets()

  const groupedCategories = useMemo(
    () => groupByGroup(categoriesData?.data ?? []),
    [categoriesData?.data],
  )

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction(transactionId ?? '')

  const activeMutation = mode === 'edit' ? updateMutation : createMutation

  const onSubmit = async (data: CreateTransactionInput) => {
    if (mode === 'edit') {
      await updateMutation.mutateAsync(data)
    } else {
      await createMutation.mutateAsync(data)
    }
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Loại giao dịch</label>
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            disabled={mode === 'edit'}
            onClick={() => setValue('type', 'expense')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              selectedType === 'expense'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            Chi tiêu
          </button>
          <button
            type="button"
            disabled={mode === 'edit'}
            onClick={() => setValue('type', 'income')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              selectedType === 'income'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            Thu nhập
          </button>
        </div>
      </div>

      {/* Amount */}
      <AmountInput control={control} error={errors.amount?.message} />

      {/* Category */}
      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
          Danh mục
        </label>
        {catsLoading ? (
          <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
        ) : (
          <select
            id="categoryId"
            {...register('categoryId')}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Chọn danh mục</option>
            {groupedCategories.map(([groupName, cats]) => (
              <optgroup key={groupName} label={groupName}>
                {cats.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        {errors.categoryId && (
          <p className="mt-1 text-sm text-red-600">Vui lòng chọn danh mục</p>
        )}
      </div>

      {/* Wallet */}
      <div>
        <label htmlFor="walletId" className="block text-sm font-medium text-gray-700 mb-1">
          Ví
        </label>
        {walletsLoading ? (
          <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
        ) : (
          <select
            id="walletId"
            {...register('walletId')}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Chọn ví</option>
            {walletsData?.data.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
        )}
        {errors.walletId && (
          <p className="mt-1 text-sm text-red-600">Vui lòng chọn ví</p>
        )}
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
          Ngày
        </label>
        <input
          id="date"
          type="date"
          {...register('date')}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {errors.date && (
          <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
        )}
      </div>

      {/* Note */}
      <div>
        <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
          Ghi chú <span className="font-normal text-gray-400">(tùy chọn)</span>
        </label>
        <textarea
          id="note"
          {...register('note')}
          rows={2}
          maxLength={500}
          placeholder="Nhập ghi chú..."
          className="block w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {errors.note && (
          <p className="mt-1 text-sm text-red-600">{errors.note.message}</p>
        )}
      </div>

      {/* Server error */}
      {activeMutation.error && (
        <p className="text-sm text-red-600">{activeMutation.error.message}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting || activeMutation.isPending}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activeMutation.isPending ? 'Đang lưu...' : 'Lưu giao dịch'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
        )}
      </div>
    </form>
  )
}
