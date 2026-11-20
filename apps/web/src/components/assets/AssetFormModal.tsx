import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type Asset, type AssetType, type GoldUnit, type UserProfile } from '@pf/shared'
import { useCreateAsset, useUpdateAsset } from '../../hooks/useAssets'
import { apiClient } from '../../services/apiClient'
import { formatCurrency } from '../../utils/format'
import { calculateGoldValueFromPrice, parseGoldMetadata } from '../../utils/gold'

type FormType = Exclude<AssetType, 'bank'>
type AccountKind = 'cash' | 'bank'

interface FormState {
  type: FormType
  accountKind: AccountKind
  name: string
  currentValue: string
  bankName: string
  goldUnit: GoldUnit
  goldQty: string
  goldPurchaseAmount: string
  ticker: string
  stockQty: string
  stockAvgBuyPrice: string
  stockCurrentPrice: string
  savingsBankName: string
  savingsDepositAmount: string
  savingsInterestRate: string
  savingsTerm: string
  savingsDepositDate: string
  address: string
  debtOriginalAmount: string
  debtRemaining: string
  debtInterestRate: string
  debtStartDate: string
  debtTerm: string
  note: string
}

interface Props { isOpen: boolean; onClose: () => void; asset?: Asset | null; defaultTab?: AssetType }

const TYPE_CHOICES: Array<{ type: FormType; label: string; icon: string }> = [
  { type: 'cash', label: 'Tiền mặt', icon: '▣' }, { type: 'gold', label: 'Vàng', icon: '◉' },
  { type: 'stock', label: 'Cổ phiếu', icon: '⌁' }, { type: 'savings', label: 'Tiết kiệm', icon: '▥' },
  { type: 'debt', label: 'Nợ', icon: '▤' }, { type: 'real_estate', label: 'BĐS', icon: '⌂' },
]

function emptyState(type: FormType = 'cash'): FormState {
  return { type, accountKind: 'cash', name: '', currentValue: '', bankName: '', goldUnit: 'luong', goldQty: '', goldPurchaseAmount: '', ticker: '', stockQty: '', stockAvgBuyPrice: '', stockCurrentPrice: '', savingsBankName: '', savingsDepositAmount: '', savingsInterestRate: '', savingsTerm: '12', savingsDepositDate: '', address: '', debtOriginalAmount: '', debtRemaining: '', debtInterestRate: '', debtStartDate: '', debtTerm: '12', note: '' }
}

function readMetadata(value: string | null): Record<string, unknown> { if (!value) return {}; try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {} } catch { return {} } }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback }
function numeric(value: unknown, fallback = ''): string { return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback }
function cents(value: string): number { return Math.round((Number(value) || 0) * 100) }
function unitLabel(unit: GoldUnit): string { return unit === 'luong' ? 'Lượng' : unit === 'chi' ? 'Chỉ' : 'Phân' }

function formFromAsset(asset: Asset): FormState {
  const metadata = readMetadata(asset.metadata)
  const parsedGold = parseGoldMetadata(asset.metadata)
  const type = asset.type === 'bank' ? 'cash' : asset.type as FormType
  const quantity = typeof metadata.quantity === 'number' ? metadata.quantity : 0
  return { ...emptyState(type), accountKind: asset.type === 'bank' ? 'bank' : 'cash', name: asset.name, currentValue: String(asset.currentValue / 100), bankName: text(metadata.bankName), goldUnit: parsedGold?.unit ?? 'luong', goldQty: parsedGold ? String(parsedGold.quantity) : '', goldPurchaseAmount: parsedGold?.purchaseAmount ? String(parsedGold.purchaseAmount / 100) : '', ticker: text(metadata.ticker), stockQty: numeric(quantity), stockAvgBuyPrice: typeof metadata.avgBuyPrice === 'number' ? String(metadata.avgBuyPrice / 100) : '', stockCurrentPrice: quantity > 0 ? String(asset.currentValue / 100 / quantity) : '', savingsBankName: text(metadata.bankName), savingsDepositAmount: typeof metadata.depositAmount === 'number' ? String(metadata.depositAmount / 100) : String(asset.currentValue / 100), savingsInterestRate: numeric(metadata.interestRate), savingsTerm: numeric(metadata.term, '12'), savingsDepositDate: text(metadata.depositDate), address: text(metadata.address), debtOriginalAmount: typeof metadata.originalAmount === 'number' ? String(metadata.originalAmount / 100) : String(asset.currentValue / 100), debtRemaining: String(asset.currentValue / 100), debtInterestRate: numeric(metadata.interestRate), debtStartDate: text(metadata.startDate), debtTerm: numeric(metadata.term, '12'), note: asset.note ?? '' }
}

export default function AssetFormModal({ isOpen, onClose, asset, defaultTab }: Props) {
  const [form, setForm] = useState<FormState>(emptyState(defaultTab === 'bank' ? 'cash' : (defaultTab as FormType | undefined) ?? 'cash'))
  const [error, setError] = useState('')
  const createMutation = useCreateAsset(); const updateMutation = useUpdateAsset()
  const { data: profileRes } = useQuery({ queryKey: QUERY_KEYS.profile, queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile') })
  const goldPrice = profileRes?.data?.goldPricePerLuong ?? null
  const isEdit = Boolean(asset); const isPending = createMutation.isPending || updateMutation.isPending
  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const currentType = form.type

  useEffect(() => { if (!isOpen) return; setForm(asset ? formFromAsset(asset) : emptyState(defaultTab === 'bank' ? 'cash' : (defaultTab as FormType | undefined) ?? 'cash')); setError('') }, [isOpen, asset, defaultTab])
  useEffect(() => { if (isOpen && form.type === 'gold' && goldPrice) setForm((current) => ({ ...current, currentValue: String(goldPrice / 100) })) }, [isOpen, form.type, goldPrice])

  const goldValue = useMemo(() => { const quantity = Number(form.goldQty); return goldPrice && quantity > 0 ? calculateGoldValueFromPrice(form.goldUnit, quantity, goldPrice) : 0 }, [form.goldQty, form.goldUnit, goldPrice])
  const stockValue = Math.round((Number(form.stockQty) || 0) * (Number(form.stockCurrentPrice) || 0) * 100)
  const stockCost = Math.round((Number(form.stockQty) || 0) * (Number(form.stockAvgBuyPrice) || 0) * 100)
  const stockPnl = stockValue - stockCost
  const savingsInterest = Math.round(cents(form.savingsDepositAmount) * (Number(form.savingsInterestRate) || 0) / 100 * ((Number(form.savingsTerm) || 0) / 12))
  const debtOriginal = cents(form.debtOriginalAmount); const debtRemaining = cents(form.debtRemaining); const debtPaid = Math.max(0, debtOriginal - debtRemaining)

  if (!isOpen) return null

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); if (!form.name.trim()) { setError('Vui lòng nhập tên tài sản'); return }
    let type: AssetType = form.type; let currentValue = cents(form.currentValue); let metadata: Record<string, unknown> | null = null
    if (form.type === 'cash') { type = form.accountKind; metadata = form.accountKind === 'bank' ? { bankName: form.bankName.trim() } : null }
    else if (form.type === 'gold') { const quantity = Number(form.goldQty); if (!goldPrice || quantity <= 0) { setError(goldPrice ? 'Số lượng vàng phải lớn hơn 0' : 'Hãy cấu hình giá vàng trước khi lưu'); return }; type = 'gold'; currentValue = 0; metadata = { unit: form.goldUnit, quantity, ...(Number(form.goldPurchaseAmount) > 0 ? { purchaseAmount: cents(form.goldPurchaseAmount) } : {}) } }
    else if (form.type === 'stock') { if (!form.ticker.trim() || Number(form.stockQty) <= 0 || Number(form.stockCurrentPrice) < 0) { setError('Vui lòng nhập mã, số lượng và giá hiện tại hợp lệ'); return }; currentValue = stockValue; metadata = { ticker: form.ticker.trim().toUpperCase(), quantity: Number(form.stockQty), avgBuyPrice: cents(form.stockAvgBuyPrice) } }
    else if (form.type === 'savings') { if (cents(form.savingsDepositAmount) <= 0 || Number(form.savingsInterestRate) < 0 || Number(form.savingsTerm) <= 0 || !form.savingsDepositDate) { setError('Vui lòng nhập đủ thông tin sổ tiết kiệm'); return }; currentValue = cents(form.savingsDepositAmount); metadata = { bankName: form.savingsBankName.trim(), depositAmount: currentValue, interestRate: Number(form.savingsInterestRate), term: Number(form.savingsTerm), depositDate: form.savingsDepositDate } }
    else if (form.type === 'debt') { if (debtOriginal <= 0 || debtRemaining < 0 || debtRemaining > debtOriginal) { setError('Số dư nợ phải nằm trong khoảng từ 0 đến khoản vay gốc'); return }; type = 'debt'; currentValue = debtRemaining; metadata = { originalAmount: debtOriginal, interestRate: Number(form.debtInterestRate) || 0, startDate: form.debtStartDate, term: Number(form.debtTerm) || 0 } }
    else if (form.type === 'real_estate') { if (currentValue < 0) { setError('Giá trị bất động sản không hợp lệ'); return }; metadata = { address: form.address.trim() } }
    const payload = { type, name: form.name.trim(), currentValue: type === 'gold' ? undefined : currentValue, metadata: metadata ? JSON.stringify(metadata) : undefined, note: form.note.trim() || undefined }
    try { if (asset) await updateMutation.mutateAsync({ id: asset.id, data: payload }); else await createMutation.mutateAsync(payload); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu tài sản') }
  }

  const field = (label: string, key: keyof FormState, options: { type?: string; required?: boolean; placeholder?: string; unit?: string; readOnly?: boolean } = {}) => <label className="asset-form-field"><span>{label} {options.required && <em>*</em>}</span><div className={options.unit ? 'asset-input-unit' : ''}><input type={options.type ?? 'text'} value={form[key] as string} onChange={(event) => set(key, event.target.value)} placeholder={options.placeholder} readOnly={options.readOnly} min={options.type === 'number' ? 0 : undefined} step={options.type === 'number' ? 'any' : undefined} />{options.unit && <b>{options.unit}</b>}</div></label>
  const typeOptions = TYPE_CHOICES.map((choice) => <button key={choice.type} type="button" className={`asset-type-option ${currentType === choice.type ? 'on' : ''}`} onClick={() => setForm((value) => ({ ...value, type: choice.type }))}><span>{choice.icon}</span>{choice.label}</button>)

  return <div className="asset-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className="asset-form-modal" role="dialog" aria-modal="true" aria-labelledby="asset-form-title"><header><div><h2 id="asset-form-title">{isEdit ? 'Sửa tài sản' : 'Thêm tài sản'}</h2><p>{isEdit ? 'Cập nhật thông tin và giá trị hiện tại' : 'Chọn loại tài sản để nhập đúng thông tin'}</p></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header><form onSubmit={submit}><div className="asset-form-body"><div className="asset-form-field"><span>Loại tài sản</span><div className="asset-type-grid">{typeOptions}</div></div>{currentType === 'cash' && <><div className="asset-form-field"><span>Loại tài khoản</span><div className="asset-segment"><button type="button" className={form.accountKind === 'cash' ? 'on' : ''} onClick={() => set('accountKind', 'cash')}>Tiền mặt</button><button type="button" className={form.accountKind === 'bank' ? 'on' : ''} onClick={() => set('accountKind', 'bank')}>Ngân hàng</button></div></div>{field('Tên tài sản', 'name', { required: true, placeholder: form.accountKind === 'bank' ? 'Tài khoản VPBank' : 'Ví tiền mặt' })}{form.accountKind === 'bank' && field('Ngân hàng', 'bankName', { placeholder: 'VD: Vietcombank' })}{field('Giá trị hiện tại', 'currentValue', { type: 'number', required: true, placeholder: '0', unit: '₫' })}</>}{currentType === 'gold' && <><div className="asset-form-grid two">{field('Tên lô vàng', 'name', { required: true, placeholder: 'Nhẫn trơn 9999' })}<div className="asset-form-field"><span>Đơn vị</span><div className="asset-segment three">{(['luong', 'chi', 'phan'] as GoldUnit[]).map((unit) => <button key={unit} type="button" className={form.goldUnit === unit ? 'on' : ''} onClick={() => set('goldUnit', unit)}>{unitLabel(unit)}</button>)}</div></div></div>{field('Số lượng', 'goldQty', { type: 'number', required: true, placeholder: '1' })}<div className="asset-form-grid two">{field('Giá mua', 'goldPurchaseAmount', { type: 'number', placeholder: 'Tổng tiền đã trả', unit: '₫' })}{field('Giá hiện tại', 'currentValue', { type: 'text', unit: '₫/lượng', readOnly: true, placeholder: goldPrice ? formatCurrency(goldPrice) : 'Chưa cấu hình' })}</div><div className="asset-calculation"><span>Giá trị hiện tại</span><strong>{formatCurrency(goldValue)}</strong><span>Lãi / lỗ</span><b className={Number(form.goldPurchaseAmount) > 0 && goldValue - cents(form.goldPurchaseAmount) < 0 ? 'negative' : ''}>{Number(form.goldPurchaseAmount) > 0 ? `${goldValue - cents(form.goldPurchaseAmount) >= 0 ? '+' : ''}${formatCurrency(goldValue - cents(form.goldPurchaseAmount))}` : 'Chưa có giá vốn'}</b></div></>}{currentType === 'stock' && <><div className="asset-form-grid two">{field('Mã cổ phiếu', 'ticker', { required: true, placeholder: 'DCM' })}{field('Tên hiển thị', 'name', { required: true, placeholder: 'Phân bón Cà Mau' })}</div><div className="asset-form-grid three">{field('Số lượng', 'stockQty', { type: 'number', required: true, placeholder: '2.000', unit: 'cp' })}{field('Giá mua TB', 'stockAvgBuyPrice', { type: 'number', placeholder: '32.000', unit: '₫' })}{field('Giá hiện tại', 'stockCurrentPrice', { type: 'number', required: true, placeholder: '38.500', unit: '₫' })}</div><div className="asset-calculation"><span>Giá trị hiện tại</span><strong>{formatCurrency(stockValue)}</strong><span>Lãi / lỗ</span><b className={stockPnl < 0 ? 'negative' : ''}>{stockPnl >= 0 ? '+' : ''}{formatCurrency(stockPnl)}</b></div></>}{currentType === 'savings' && <><div className="asset-form-grid two">{field('Tên sổ', 'name', { required: true, placeholder: 'Sổ tiết kiệm VCB' })}{field('Ngân hàng', 'savingsBankName', { placeholder: 'Vietcombank' })}</div><div className="asset-form-grid two">{field('Số tiền gửi', 'savingsDepositAmount', { type: 'number', required: true, placeholder: '100.000.000', unit: '₫' })}{field('Lãi suất', 'savingsInterestRate', { type: 'number', required: true, placeholder: '6,2', unit: '%/năm' })}</div><div className="asset-form-field"><span>Kỳ hạn</span><div className="asset-chip-list">{[1, 3, 6, 12, 24].map((term) => <button type="button" key={term} className={form.savingsTerm === String(term) ? 'on' : ''} onClick={() => set('savingsTerm', String(term))}>{term} tháng</button>)}</div></div>{field('Ngày gửi', 'savingsDepositDate', { type: 'date', required: true })}<div className="asset-calculation"><span>Ngày đáo hạn</span><strong>{form.savingsDepositDate && form.savingsTerm ? new Date(new Date(`${form.savingsDepositDate}T00:00:00`).setMonth(new Date(`${form.savingsDepositDate}T00:00:00`).getMonth() + Number(form.savingsTerm))).toLocaleDateString('vi-VN') : '—'}</strong><span>Lãi dự kiến</span><b>+{formatCurrency(savingsInterest)}</b></div></>}{currentType === 'debt' && <><div className="asset-form-grid two">{field('Tên khoản nợ', 'name', { required: true, placeholder: 'Vay mua xe' })}{field('Lãi suất', 'debtInterestRate', { type: 'number', placeholder: '9,0', unit: '%/năm' })}</div><div className="asset-form-grid two">{field('Khoản vay gốc', 'debtOriginalAmount', { type: 'number', required: true, placeholder: '60.000.000', unit: '₫' })}{field('Còn nợ', 'debtRemaining', { type: 'number', required: true, placeholder: '42.000.000', unit: '₫' })}</div><div className="asset-form-grid two">{field('Ngày bắt đầu', 'debtStartDate', { type: 'date' })}{field('Kỳ hạn', 'debtTerm', { type: 'number', placeholder: '36', unit: 'tháng' })}</div><div className="asset-calculation"><span>Đã trả</span><strong>{formatCurrency(debtPaid)}</strong><b>{debtOriginal > 0 ? `${Math.round(debtPaid / debtOriginal * 100)}%` : '0%'}</b></div></>}{currentType === 'real_estate' && <><div className="asset-form-grid two">{field('Tên bất động sản', 'name', { required: true, placeholder: 'Căn hộ Vinhomes' })}{field('Giá trị hiện tại', 'currentValue', { type: 'number', required: true, placeholder: '2.000.000.000', unit: '₫' })}</div>{field('Địa chỉ', 'address', { placeholder: 'Quận 1, TP.HCM' })}</>}{field('Ghi chú', 'note', { placeholder: 'Thêm ghi chú...' })}{error && <p className="asset-form-error">{error}</p>}</div><footer><span>Giá trị được tính lại theo thông tin bạn nhập</span><button type="button" onClick={onClose}>Hủy</button><button type="submit" className="asset-primary-button" disabled={isPending}>{isPending ? 'Đang lưu...' : 'Lưu tài sản'}</button></footer></form></section></div>
}
