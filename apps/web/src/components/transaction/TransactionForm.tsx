import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useForm, useController, type Control, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  createTransactionSchema,
  updateTransactionSchema,
  type Asset,
  type CategoryWithGroup,
  type CreateTransactionInput,
} from '@pf/shared'
import { useCategories } from '../../hooks/useCategories'
import { useWallets } from '../../hooks/useWallets'
import { useAssets } from '../../hooks/useAssets'
import { useCreateTransaction, useCreateTransfer, useUpdateTransaction } from '../../hooks/useTransactions'
import { formatCurrency } from '../../utils/format'
import TransactionCategoryIcon from './TransactionCategoryIcon'
import './transaction-form.css'

type TransactionFormAppearance = 'default' | 'modal' | 'redesigned'
type FormType = 'income' | 'expense' | 'transfer'
type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly'
type ExtendedDefaults = Partial<CreateTransactionInput> & { recurrenceInterval?: RecurrenceInterval }

interface TransactionFormProps {
  mode: 'create' | 'edit'
  transactionId?: string
  defaultValues?: ExtendedDefaults
  onSuccess?: () => void
  onCancel?: () => void
  appearance?: TransactionFormAppearance
  variant?: 'default' | 'redesigned'
  onSaveAndContinue?: () => void
}

interface WalletOption {
  id: string
  name: string
  type: 'wallet' | 'bank' | 'cash'
  balance?: number
}

/**
 * Chuyển khoản không có danh mục nhưng cần tài khoản đích. Dùng cùng tên trường với form
 * thu/chi (walletId = nguồn, toWalletId = đích) để lỗi hiện đúng chỗ.
 */
const transferFormSchema = z.object({
  type: z.literal('transfer'),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0'),
  walletId: z.string().min(1, 'Chọn tài khoản nguồn'),
  toWalletId: z.string({ required_error: 'Chọn tài khoản đích' }).min(1, 'Chọn tài khoản đích'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày: YYYY-MM-DD'),
  note: z.string().max(500).optional(),
}).refine((value) => value.walletId !== value.toWalletId, { message: 'Tài khoản nguồn và đích phải khác nhau', path: ['toWalletId'] })
const transferResolver = zodResolver(transferFormSchema)

function todayString(): string {
  return new Date().toLocaleDateString('sv')
}

function initialFormValues(defaultValues?: ExtendedDefaults, mode: 'create' | 'edit' = 'create'): CreateTransactionInput {
  return {
    type: defaultValues?.type === 'income' ? 'income' : 'expense',
    amount: defaultValues?.amount ?? 0,
    categoryId: defaultValues?.categoryId ?? '',
    walletId: defaultValues?.walletId ?? '',
    date: defaultValues?.date ?? todayString(),
    note: defaultValues?.note ?? '',
    isRecurring: defaultValues?.isRecurring ?? false,
    // Create forms need a valid interval as soon as recurring is enabled. For
    // edits, leave a missing interval untouched so an existing server value is
    // not silently replaced with a different schedule.
    recurrenceInterval: defaultValues?.recurrenceInterval ?? (mode === 'create' ? 'monthly' : undefined),
  }
}

function groupByGroup(categories: CategoryWithGroup[]) {
  const map = new Map<string, CategoryWithGroup[]>()
  for (const category of categories) {
    const key = category.group?.name ?? 'Khác'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(category)
  }
  return Array.from(map.entries())
}

function AmountInput({
  control,
  error,
  modal,
  selectedType,
  onQuickAdd,
}: {
  control: Control<CreateTransactionInput>
  error?: string
  modal: boolean
  selectedType: FormType
  onQuickAdd?: (amountCents: number) => void
}) {
  const { field } = useController({ name: 'amount', control })
  const displayValue = field.value > 0 ? Math.round(field.value / 100).toLocaleString('vi-VN') : ''

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^\d]/g, '')
    field.onChange(raw ? parseInt(raw, 10) * 100 : 0)
  }

  return (
    <div className={modal ? 'txf-field' : undefined}>
      <label className={modal ? 'txf-label' : 'block text-sm font-medium text-gray-700 mb-1'} htmlFor="transaction-amount">
        Số tiền <span className={modal ? 'txf-optional' : 'text-gray-400'}>(₫)</span>
      </label>
      <div className={modal ? 'txf-amount' : undefined}>
        {modal && <span className={`txf-amount-sign ${selectedType === 'income' ? 'is-income' : selectedType === 'transfer' ? 'is-transfer' : ''}`} aria-hidden="true">{selectedType === 'income' ? '+' : selectedType === 'transfer' ? '⇄' : '−'}</span>}
        <input
          id="transaction-amount"
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={field.onBlur}
          placeholder="0"
          aria-invalid={!!error}
          aria-describedby={modal ? (error ? 'transaction-amount-error' : 'transaction-amount-hint') : undefined}
          className={modal ? 'txf-amount-input' : 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'}
        />
        {modal && <span className="txf-currency" aria-hidden="true">₫</span>}
      </div>
      {modal && (
        <div className="txf-quick" id="transaction-amount-hint" aria-label="Thêm nhanh số tiền">
          {[10_000, 50_000, 100_000, 500_000, 1_000_000].map((amount) => (
            <button key={amount} type="button" onClick={() => onQuickAdd?.(amount * 100)}>
              +{amount >= 1_000_000 ? '1 triệu' : `${amount / 1_000}K`}
            </button>
          ))}
        </div>
      )}
      {error && <p className={modal ? 'txf-error' : 'mt-1 text-sm text-red-600'} id={modal ? 'transaction-amount-error' : undefined}>{error}</p>}
    </div>
  )
}

const TYPE_LABEL: Record<FormType, { label: string; icon: string }> = {
  expense: { label: 'Chi tiêu', icon: '↗' },
  income: { label: 'Thu nhập', icon: '↘' },
  transfer: { label: 'Chuyển khoản', icon: '⇄' },
}

function TypeToggle({ mode, selectedType, setType, modal }: { mode: 'create' | 'edit'; selectedType: FormType; setType: (type: FormType) => void; modal: boolean }) {
  // Chuyển khoản chỉ tạo mới được (sửa chuyển khoản = xóa và tạo lại).
  const types: FormType[] = mode === 'create' ? ['expense', 'income', 'transfer'] : ['expense', 'income']
  return (
    <div className={modal ? 'txf-field' : undefined}>
      <span className={modal ? 'txf-label' : 'block text-sm font-medium text-gray-700 mb-1'}>Loại giao dịch</span>
      <div className={modal ? `txf-type-switch ${types.length === 3 ? 'has-three' : ''}` : 'flex rounded-md border border-gray-300 overflow-hidden'} role="radiogroup" aria-label="Loại giao dịch">
        {types.map((type, index) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selectedType === type}
            disabled={mode === 'edit'}
            onClick={() => setType(type)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return
              event.preventDefault()
              const nextIndex = (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + types.length) % types.length
              setType(types[nextIndex])
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
            }}
            className={modal
              ? `txf-type-option ${selectedType === type ? `is-selected is-${type}` : ''}`
              : `flex-1 py-2 text-sm font-medium transition-colors ${selectedType === type ? type === 'expense' ? 'bg-red-500 text-white' : type === 'income' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {modal && <span aria-hidden="true">{TYPE_LABEL[type].icon}</span>}
            {TYPE_LABEL[type].label}
          </button>
        ))}
      </div>
      {mode === 'edit' && modal && <p className="txf-hint">Không thể đổi loại thu ↔ chi khi chỉnh sửa.</p>}
    </div>
  )
}

function CategoryField({ categories, loading, selectedCategoryId, setCategory, error, modal }: { categories: CategoryWithGroup[]; loading: boolean; selectedCategoryId: string; setCategory: (id: string) => void; error?: string; modal: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  const initialCategories = categories.slice(0, 7)
  const visibleCategories = showAll
    ? categories
    : selectedCategory && !initialCategories.some((category) => category.id === selectedCategoryId)
      ? [...initialCategories, selectedCategory]
      : initialCategories

  if (!modal) {
    return (
      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
        {loading ? <div className="h-9 rounded-md bg-gray-100 animate-pulse" /> : (
          <select id="categoryId" value={selectedCategoryId} onChange={(event) => setCategory(event.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Chọn danh mục</option>
            {groupByGroup(categories).map(([groupName, groupCategories]) => (
              <optgroup key={groupName} label={groupName}>
                {groupCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="txf-field">
      <span className="txf-label">Danh mục</span>
      {loading ? <div className="txf-category-loading" aria-label="Đang tải danh mục" /> : categories.length === 0 ? (
        <p className="txf-hint">Chưa có danh mục phù hợp với loại giao dịch này.</p>
      ) : (
        <div className="txf-category-grid" role="radiogroup" aria-label="Danh mục">
          {visibleCategories.map((category, index) => (
            <button key={category.id} type="button" role="radio" aria-checked={selectedCategoryId === category.id} className={`txf-category-option ${selectedCategoryId === category.id ? 'is-selected' : ''}`} onClick={() => setCategory(category.id)} onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return
              event.preventDefault()
              const columns = 4
              const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? columns : -columns
              const nextIndex = Math.min(Math.max(index + delta, 0), visibleCategories.length - 1)
              setCategory(visibleCategories[nextIndex].id)
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
            }}>
              <span className="txf-category-icon" style={{ background: `${category.color ?? '#EEF2FF'}22`, color: category.color ?? '#4F46E5' }}><TransactionCategoryIcon icon={category.icon} name={category.name} size={18} /></span>
              <span>{category.name}</span>
            </button>
          ))}
          {!showAll && categories.length > visibleCategories.length && <button type="button" className="txf-category-option txf-category-more" onClick={() => setShowAll(true)}><span className="txf-category-icon" aria-hidden="true">…</span><span>Xem thêm</span></button>}
        </div>
      )}
      {error && <p className="txf-error" id="transaction-category-error">Vui lòng chọn danh mục</p>}
    </div>
  )
}

function WalletField({ register, options, loading, error, modal, name = 'walletId', label = 'Ví / Tài khoản', placeholder = 'Chọn ví' }: { register: UseFormRegister<CreateTransactionInput>; options: Array<{ label: string; options: WalletOption[] }>; loading: boolean; error?: string; modal: boolean; name?: 'walletId' | 'toWalletId'; label?: string; placeholder?: string }) {
  return (
    <div className={modal ? 'txf-field' : undefined}>
      <label htmlFor={name} className={modal ? 'txf-label' : 'block text-sm font-medium text-gray-700 mb-1'}>{label}</label>
      {loading ? <div className={modal ? 'txf-select-loading' : 'h-9 rounded-md bg-gray-100 animate-pulse'} /> : (
        <select id={name} {...register(name)} className={modal ? 'txf-select' : 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'}>
          <option value="">{placeholder}</option>
          {options.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.balance !== undefined ? ` (${formatCurrency(option.balance, 'VND')})` : ''}</option>)}</optgroup>)}
        </select>
      )}
      {error && <p className={modal ? 'txf-error' : 'mt-1 text-sm text-red-600'}>{error}</p>}
    </div>
  )
}

function DateField({ register, selectedDate, setDate, error, modal }: { register: UseFormRegister<CreateTransactionInput>; selectedDate: string; setDate: (date: string) => void; error?: string; modal: boolean }) {
  const today = todayString()
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv')
  return (
    <div className={modal ? 'txf-field' : undefined}>
      <label htmlFor="date" className={modal ? 'txf-label' : 'block text-sm font-medium text-gray-700 mb-1'}>Ngày</label>
      <input id="date" type="date" {...register('date')} className={modal ? 'txf-input' : 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'} />
      {modal && <div className="txf-date-chips"><button type="button" className={selectedDate === today ? 'is-selected' : ''} aria-pressed={selectedDate === today} onClick={() => setDate(today)}>Hôm nay</button><button type="button" className={selectedDate === yesterday ? 'is-selected' : ''} aria-pressed={selectedDate === yesterday} onClick={() => setDate(yesterday)}>Hôm qua</button></div>}
      {error && <p className={modal ? 'txf-error' : 'mt-1 text-sm text-red-600'}>{error}</p>}
    </div>
  )
}

function NoteField({ register, error, modal }: { register: UseFormRegister<CreateTransactionInput>; error?: string; modal: boolean }) {
  return (
    <div className={modal ? 'txf-field' : undefined}>
      <label htmlFor="note" className={modal ? 'txf-label' : 'block text-sm font-medium text-gray-700 mb-1'}>Ghi chú <span className={modal ? 'txf-optional' : 'font-normal text-gray-400'}>(tuỳ chọn)</span></label>
      <textarea id="note" {...register('note')} rows={modal ? 3 : 2} maxLength={500} placeholder="VD: ăn tối, mua đồ…" className={modal ? 'txf-input txf-textarea' : 'block w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'} />
      {error && <p className={modal ? 'txf-error' : 'mt-1 text-sm text-red-600'}>{error}</p>}
    </div>
  )
}

function RecurringField({ enabled, interval, setEnabled, setInterval, modal }: { enabled: boolean; interval?: RecurrenceInterval; setEnabled: (value: boolean) => void; setInterval: (value: RecurrenceInterval) => void; modal: boolean }) {
  if (!modal) return null
  return (
    <div className="txf-repeat">
      <span className="txf-repeat-icon" aria-hidden="true">↻</span>
      <span className="txf-repeat-copy"><strong>Lặp lại định kỳ</strong><small>Tự động tạo giao dịch hàng tuần / tháng / năm</small></span>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Bật lặp lại" className={`txf-switch ${enabled ? 'is-on' : ''}`} onClick={() => setEnabled(!enabled)}><span aria-hidden="true" /></button>
      {enabled && <label className="txf-interval-label">Chu kỳ<select value={interval ?? 'monthly'} onChange={(event) => setInterval(event.target.value as RecurrenceInterval)} className="txf-interval-select" aria-label="Chu kỳ lặp lại"><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option><option value="yearly">Hàng năm</option></select></label>}
    </div>
  )
}

export default function TransactionForm({ mode, transactionId, defaultValues, onSuccess, onCancel, appearance = 'default', variant = 'default', onSaveAndContinue }: TransactionFormProps) {
  const modal = appearance === 'modal' || appearance === 'redesigned' || variant === 'redesigned'
  const initialValues = useMemo(() => initialFormValues(defaultValues, mode), [defaultValues, mode])
  const baseResolver = mode === 'create' ? zodResolver(createTransactionSchema) : zodResolver(updateTransactionSchema)
  const resolver: typeof baseResolver = (values, context, options) => values.type === 'transfer'
    ? (transferResolver as unknown as typeof baseResolver)(values, context, options)
    : baseResolver(values, context, options)
  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors, isSubmitting } } = useForm<CreateTransactionInput>({ resolver, defaultValues: initialValues })
  const watchedType = watch('type')
  const selectedType: FormType = watchedType === 'income' || watchedType === 'transfer' ? watchedType : 'expense'
  const isTransfer = selectedType === 'transfer'
  const selectedCategoryId = watch('categoryId')
  const selectedDate = watch('date')
  const isRecurring = watch('isRecurring')
  const recurrenceInterval = watch('recurrenceInterval') as RecurrenceInterval | undefined
  const prevTypeRef = useRef(selectedType)
  const submissionPendingRef = useRef(false)
  useEffect(() => {
    if (mode === 'create' && prevTypeRef.current !== selectedType) {
      setValue('categoryId', '', { shouldValidate: true })
      prevTypeRef.current = selectedType
    }
  }, [selectedType, mode, setValue])
  const { data: categoriesData, isLoading: catsLoading } = useCategories(isTransfer ? 'expense' : selectedType)
  const { data: walletsData, isLoading: walletsLoading } = useWallets()
  const { data: assetsData, isLoading: assetsLoading } = useAssets()
  const categories = categoriesData?.data ?? []
  // Tài khoản có số dư = tài sản tiền mặt / ngân hàng (id dạng 'asset-<uuid>').
  const accountGroups = useMemo(() => {
    const groups: Array<{ label: string; options: WalletOption[] }> = []
    const toOption = (asset: Asset, type: 'cash' | 'bank') => ({ id: `asset-${asset.id}`, name: asset.name, type, balance: asset.currentValue })
    const cash = assetsData?.data?.filter((asset: Asset) => asset.type === 'cash').map((asset: Asset) => toOption(asset, 'cash')) ?? []
    const bank = assetsData?.data?.filter((asset: Asset) => asset.type === 'bank').map((asset: Asset) => toOption(asset, 'bank')) ?? []
    if (cash.length) groups.push({ label: 'Tiền mặt', options: cash })
    if (bank.length) groups.push({ label: 'Tài khoản ngân hàng', options: bank })
    return groups
  }, [assetsData?.data])
  // Ví kiểu cũ (không có số dư) chỉ còn cho thu/chi, nếu người dùng vẫn còn.
  const walletOptions = useMemo(() => {
    const wallets = walletsData?.data?.map((wallet) => ({ id: wallet.id, name: wallet.name, type: 'wallet' as const })) ?? []
    return wallets.length ? [{ label: 'Ví', options: wallets }, ...accountGroups] : accountGroups
  }, [walletsData?.data, accountGroups])
  const isLoading = walletsLoading || assetsLoading
  const createMutation = useCreateTransaction()
  const createTransferMutation = useCreateTransfer()
  const updateMutation = useUpdateTransaction(transactionId ?? '')
  const activeMutation = mode === 'edit' ? updateMutation : isTransfer ? createTransferMutation : createMutation
  const setType = (type: FormType) => {
    if (type === 'transfer') setValue('isRecurring', false)
    // Ô "Đến tài khoản" chỉ có ở chuyển khoản; bỏ giá trị cũ để không chặn validate thu/chi.
    else setValue('toWalletId', undefined)
    setValue('type', type, { shouldDirty: true, shouldValidate: true })
  }
  const setCategory = (categoryId: string) => setValue('categoryId', categoryId, { shouldDirty: true, shouldValidate: true })
  const setDate = (date: string) => setValue('date', date, { shouldDirty: true, shouldValidate: true })
  const addQuickAmount = (amountCents: number) => setValue('amount', (watch('amount') || 0) + amountCents, { shouldDirty: true, shouldValidate: true })
  const onSubmit = async (data: CreateTransactionInput, continueAdding = false) => {
    if (submissionPendingRef.current) return
    submissionPendingRef.current = true
    try {
      const payload = data.isRecurring && data.recurrenceInterval
        ? data
        : data.isRecurring
          ? { ...data, recurrenceInterval: mode === 'create' ? 'monthly' as const : undefined }
          : data
      if (mode === 'edit') await updateMutation.mutateAsync(payload)
      else if (data.type === 'transfer') {
        await createTransferMutation.mutateAsync({ fromAccountId: data.walletId, toAccountId: data.toWalletId ?? '', amount: data.amount, date: data.date, note: data.note || undefined })
      } else await createMutation.mutateAsync(payload)
      if (continueAdding && mode === 'create') {
        reset({ ...initialValues, type: data.type, amount: 0, categoryId: '', walletId: '', toWalletId: undefined, date: todayString(), note: '', isRecurring: false, recurrenceInterval: 'monthly' })
        onSaveAndContinue?.()
        return
      }
      onSuccess?.()
    } catch {
      // Keep the form open and its values intact so the mutation error remains visible.
    } finally {
      submissionPendingRef.current = false
    }
  }
  const handleShortcut = (event: KeyboardEvent<HTMLFormElement>) => {
    if (modal && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void handleSubmit((data) => onSubmit(data))()
    }
  }
  const formBody = <>
    <TypeToggle mode={mode} selectedType={selectedType} setType={setType} modal={modal} />
    <AmountInput control={control} error={errors.amount?.message} modal={modal} selectedType={selectedType} onQuickAdd={modal ? addQuickAmount : undefined} />
    {isTransfer ? <>
      {modal ? <div className="txf-two-column"><WalletField register={register} options={accountGroups} loading={isLoading} error={errors.walletId?.message} modal label="Từ tài khoản" placeholder="Chọn tài khoản" /><WalletField register={register} name="toWalletId" options={accountGroups} loading={isLoading} error={errors.toWalletId?.message} modal label="Đến tài khoản" placeholder="Chọn tài khoản" /></div> : <><WalletField register={register} options={accountGroups} loading={isLoading} error={errors.walletId?.message} modal={false} label="Từ tài khoản" placeholder="Chọn tài khoản" /><WalletField register={register} name="toWalletId" options={accountGroups} loading={isLoading} error={errors.toWalletId?.message} modal={false} label="Đến tài khoản" placeholder="Chọn tài khoản" /></>}
      <DateField register={register} selectedDate={selectedDate} setDate={setDate} error={errors.date?.message} modal={modal} />
    </> : <>
      <CategoryField categories={categories} loading={catsLoading} selectedCategoryId={selectedCategoryId} setCategory={setCategory} error={errors.categoryId?.message} modal={modal} />
      {modal ? <div className="txf-two-column"><WalletField register={register} options={walletOptions} loading={isLoading} error={errors.walletId?.message} modal /><DateField register={register} selectedDate={selectedDate} setDate={setDate} error={errors.date?.message} modal /></div> : <><WalletField register={register} options={walletOptions} loading={isLoading} error={errors.walletId?.message} modal={false} /><DateField register={register} selectedDate={selectedDate} setDate={setDate} error={errors.date?.message} modal={false} /></>}
    </>}
    <NoteField register={register} error={errors.note?.message} modal={modal} />
    {!isTransfer && <RecurringField enabled={isRecurring} interval={recurrenceInterval} setEnabled={(value) => {
      setValue('isRecurring', value, { shouldDirty: true, shouldValidate: true })
      if (value && mode === 'create' && !watch('recurrenceInterval')) {
        setValue('recurrenceInterval', 'monthly', { shouldDirty: true, shouldValidate: true })
      }
    }} setInterval={(value) => setValue('recurrenceInterval', value, { shouldDirty: true, shouldValidate: true })} modal={modal} />}
    {activeMutation.error && <p className={modal ? 'txf-server-error' : 'text-sm text-red-600'} role="alert">{activeMutation.error.message}</p>}
  </>
  if (!modal) return <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">{formBody}<div className="flex gap-3 pt-1"><button type="submit" disabled={isSubmitting || activeMutation.isPending} className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">{activeMutation.isPending ? 'Đang lưu...' : 'Lưu giao dịch'}</button>{onCancel && <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Hủy</button>}</div></form>
  return <form className="txf-modal" onSubmit={handleSubmit((data) => onSubmit(data))} onKeyDown={handleShortcut}>
    <header className="txf-header"><h2>{mode === 'create' ? 'Thêm giao dịch' : 'Chỉnh sửa giao dịch'}</h2>{onCancel && <button type="button" className="txf-close" aria-label="Đóng" onClick={onCancel}>×</button>}</header>
    <div className="txf-body">{formBody}</div>
    <footer className="txf-footer"><span className="txf-footer-hint"><kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> để lưu</span>{onCancel && <button type="button" className="txf-button txf-button-ghost" onClick={onCancel}>Huỷ</button>}{mode === 'create' && <button type="button" className="txf-button" disabled={isSubmitting || activeMutation.isPending} onClick={() => void handleSubmit((data) => onSubmit(data, true))()}>{activeMutation.isPending ? 'Đang lưu...' : 'Lưu & thêm tiếp'}</button>}<button type="submit" className="txf-button txf-button-primary" disabled={isSubmitting || activeMutation.isPending}>{activeMutation.isPending ? 'Đang lưu...' : 'Lưu giao dịch'}</button></footer>
  </form>
}
