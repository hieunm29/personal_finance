import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type Asset, type AssetType, type UserProfile } from '@pf/shared'
import { useCreateAsset, useUpdateAsset } from '../../hooks/useAssets'
import { apiClient } from '../../services/apiClient'
import { formatCurrency } from '../../utils/format'
import {
  calculateGoldValueFromPrice,
  getGoldPriceStatusMessage,
  parseGoldMetadata,
} from '../../utils/gold'

const TYPE_LABELS: Record<string, string> = {
  cash: '💵 Tiền mặt',
  bank: '🏦 Ngân hàng',
  gold: '🥇 Vàng',
  stock: '📈 Cổ phiếu',
  savings: '🏛️ Tiết kiệm',
  real_estate: '🏠 Bất động sản',
  debt: '💳 Nợ',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  asset?: Asset | null
  defaultTab?: AssetType
}

interface FormValues {
  name: string
  type: AssetType
  currentValueDisplay: number
  note: string
  // bank
  bankName: string
  // gold
  goldUnit: 'chi' | 'luong'
  goldQty: number
  // stock
  ticker: string
  stockQty: number
  stockAvgBuyPrice: number
  // savings
  savingsBankName: string
  savingsDepositAmount: number
  savingsInterestRate: number
  savingsTerm: number
  savingsDepositDate: string
  // real_estate
  address: string
  // debt
  debtOriginalAmount: number
  debtInterestRate: number
  debtStartDate: string
  debtTerm: number
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#0f172a',
  boxSizing: 'border-box',
  outline: 'none',
}

const fieldStyle: React.CSSProperties = { marginBottom: '14px' }

export default function AssetFormModal({ isOpen, onClose, asset, defaultTab }: Props) {
  const isEdit = !!asset
  const createMutation = useCreateAsset()
  const updateMutation = useUpdateAsset()
  const isPending = createMutation.isPending || updateMutation.isPending

  const { register, handleSubmit, watch, reset, setValue } = useForm<FormValues>({
    defaultValues: {
      name: '',
      type: defaultTab ?? 'cash',
      currentValueDisplay: 0,
      note: '',
      bankName: '',
      goldUnit: 'chi',
      goldQty: 0,
      ticker: '',
      stockQty: 1,
      stockAvgBuyPrice: 0,
      savingsBankName: '',
      savingsDepositAmount: 0,
      savingsInterestRate: 0,
      savingsTerm: 12,
      savingsDepositDate: '',
      address: '',
      debtOriginalAmount: 0,
      debtInterestRate: 0,
      debtStartDate: '',
      debtTerm: 12,
    },
  })

  const type = watch('type')
  const goldUnit = watch('goldUnit')
  const goldQty = watch('goldQty')
  const { data: profileRes } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
  })
  const goldPricePerLuong = profileRes?.data?.goldPricePerLuong ?? null
  const goldPriceStatusMessage = type === 'gold' ? getGoldPriceStatusMessage(goldPricePerLuong) : null
  const hasValidGoldQty = typeof goldQty === 'number' && Number.isFinite(goldQty) && goldQty >= 0
  const goldQtyStatusMessage = type === 'gold' && !hasValidGoldQty
    ? 'Số lượng vàng không hợp lệ'
    : null
  const goldDerivedValue = type === 'gold' && goldPricePerLuong && hasValidGoldQty
    ? calculateGoldValueFromPrice(goldUnit, goldQty, goldPricePerLuong)
    : null
  const goldFormStatusMessage = goldPriceStatusMessage ?? goldQtyStatusMessage

  useEffect(() => {
    if (!isOpen) return
    if (asset) {
      const meta = parseGoldMetadata(asset.metadata)
      const rawMeta = asset.metadata ? (JSON.parse(asset.metadata) as Record<string, unknown>) : {}
      reset({
        name: asset.name,
        type: asset.type,
        currentValueDisplay: asset.currentValue / 100,
        note: asset.note ?? '',
        bankName: (rawMeta.bankName as string) ?? '',
        goldUnit: meta?.unit ?? 'chi',
        goldQty: meta?.quantity ?? 0,
        ticker: (rawMeta.ticker as string) ?? '',
        stockQty: (rawMeta.quantity as number) ?? 1,
        stockAvgBuyPrice: ((rawMeta.avgBuyPrice as number) ?? 0) / 100,
        savingsBankName: (rawMeta.bankName as string) ?? '',
        savingsDepositAmount: ((rawMeta.depositAmount as number) ?? 0) / 100,
        savingsInterestRate: (rawMeta.interestRate as number) ?? 0,
        savingsTerm: (rawMeta.term as number) ?? 12,
        savingsDepositDate: (rawMeta.depositDate as string) ?? '',
        address: (rawMeta.address as string) ?? '',
        debtOriginalAmount: ((rawMeta.originalAmount as number) ?? 0) / 100,
        debtInterestRate: (rawMeta.interestRate as number) ?? 0,
        debtStartDate: (rawMeta.startDate as string) ?? '',
        debtTerm: (rawMeta.term as number) ?? 12,
      })
    } else {
      reset({
        name: '',
        type: defaultTab ?? 'cash',
        currentValueDisplay: 0,
        note: '',
        bankName: '',
        goldUnit: 'chi',
        goldQty: 0,
        ticker: '',
        stockQty: 1,
        stockAvgBuyPrice: 0,
        savingsBankName: '',
        savingsDepositAmount: 0,
        savingsInterestRate: 0,
        savingsTerm: 12,
        savingsDepositDate: '',
        address: '',
        debtOriginalAmount: 0,
        debtInterestRate: 0,
        debtStartDate: '',
        debtTerm: 12,
      })
    }
  }, [isOpen, asset, defaultTab, reset])

  function buildMetadata(t: AssetType, d: FormValues): Record<string, unknown> | null {
    if (t === 'bank') return { bankName: d.bankName }
    if (t === 'gold') return { unit: d.goldUnit, quantity: d.goldQty }
    if (t === 'stock')
      return {
        ticker: d.ticker.toUpperCase(),
        quantity: d.stockQty,
        avgBuyPrice: Math.round(d.stockAvgBuyPrice * 100),
      }
    if (t === 'savings')
      return {
        bankName: d.savingsBankName,
        depositAmount: Math.round(d.savingsDepositAmount * 100),
        interestRate: d.savingsInterestRate,
        term: d.savingsTerm,
        depositDate: d.savingsDepositDate,
      }
    if (t === 'real_estate') return { address: d.address }
    if (t === 'debt')
      return {
        originalAmount: Math.round(d.debtOriginalAmount * 100),
        interestRate: d.debtInterestRate,
        startDate: d.debtStartDate,
        term: d.debtTerm,
      }
    return null
  }

  const onSubmit = handleSubmit(async (d) => {
    const metadataObj = buildMetadata(d.type, d)
    const currentValue = d.type === 'gold'
      ? undefined
      : Math.round(d.currentValueDisplay * 100)

    if (d.type === 'gold' && (goldDerivedValue == null || !Number.isFinite(goldDerivedValue))) {
      return
    }

    const payload = {
      type: d.type,
      name: d.name,
      ...(currentValue !== undefined ? { currentValue } : {}),
      metadata: metadataObj ? JSON.stringify(metadataObj) : undefined,
      note: d.note || undefined,
    }
    if (isEdit && asset) {
      await updateMutation.mutateAsync({ id: asset.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    onClose()
  })

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            {isEdit ? 'Sửa tài sản' : 'Thêm tài sản'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#64748b',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Tên tài sản *</label>
            <input {...register('name', { required: true })} style={inputStyle} placeholder="Nhập tên tài sản" />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Loại tài sản *</label>
            <select {...register('type')} style={inputStyle}>
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {type !== 'gold' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Giá trị hiện tại (VND) *</label>
              <input
                {...register('currentValueDisplay', { valueAsNumber: true, min: 0 })}
                type="number"
                min={0}
                step={1000}
                style={inputStyle}
                placeholder="0"
              />
            </div>
          )}

          {type === 'bank' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Tên ngân hàng *</label>
              <input {...register('bankName', { required: true })} style={inputStyle} placeholder="VD: Vietcombank" />
            </div>
          )}

          {type === 'gold' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Đơn vị</label>
                  <select {...register('goldUnit')} style={inputStyle}>
                    <option value="chi">Chỉ</option>
                    <option value="luong">Lượng</option>
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Số lượng</label>
                  <input
                    {...register('goldQty', {
                      valueAsNumber: true,
                      min: 0,
                      setValueAs: (value) => (value === '' || value == null ? Number.NaN : Number(value)),
                    })}
                    type="number"
                    min={0}
                    step={0.01}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Giá 1 lượng vàng (từ cấu hình vàng)</label>
                <input
                  value={goldPricePerLuong ? formatCurrency(goldPricePerLuong) : 'Chưa cấu hình'}
                  readOnly
                  style={{ ...inputStyle, background: '#f8fafc', color: goldPricePerLuong ? '#0f172a' : '#dc2626' }}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Giá trị hiện tại (tự tính)</label>
                <input
                  value={goldDerivedValue != null ? formatCurrency(goldDerivedValue) : 'Chưa thể tính'}
                  readOnly
                  style={{ ...inputStyle, background: '#f8fafc' }}
                />
                {goldFormStatusMessage && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626' }}>
                    {goldFormStatusMessage}
                  </div>
                )}
              </div>
            </>
          )}

          {type === 'stock' && (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Mã cổ phiếu</label>
                <input
                  {...register('ticker')}
                  style={inputStyle}
                  placeholder="VD: VNM"
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.value = el.value.toUpperCase()
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Số lượng *</label>
                  <input
                    {...register('stockQty', { valueAsNumber: true, min: 1 })}
                    type="number"
                    min={1}
                    step={1}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Giá mua TB (VND)</label>
                  <input
                    {...register('stockAvgBuyPrice', { valueAsNumber: true, min: 0 })}
                    type="number"
                    min={0}
                    step={100}
                    style={inputStyle}
                  />
                </div>
              </div>
            </>
          )}

          {type === 'savings' && (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Ngân hàng</label>
                <input {...register('savingsBankName')} style={inputStyle} placeholder="VD: Techcombank" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Số tiền gửi (VND)</label>
                <input
                  {...register('savingsDepositAmount', { valueAsNumber: true, min: 0 })}
                  type="number"
                  min={0}
                  step={1000}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Lãi suất (%/năm)</label>
                  <input
                    {...register('savingsInterestRate', { valueAsNumber: true, min: 0 })}
                    type="number"
                    min={0}
                    step={0.1}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Kỳ hạn (tháng)</label>
                  <input
                    {...register('savingsTerm', { valueAsNumber: true, min: 1 })}
                    type="number"
                    min={1}
                    step={1}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Ngày gửi</label>
                <input {...register('savingsDepositDate')} type="date" style={inputStyle} />
              </div>
            </>
          )}

          {type === 'real_estate' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Địa chỉ</label>
              <input {...register('address')} style={inputStyle} placeholder="Nhập địa chỉ (tuỳ chọn)" />
            </div>
          )}

          {type === 'debt' && (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Số tiền gốc (VND)</label>
                <input
                  {...register('debtOriginalAmount', { valueAsNumber: true, min: 0 })}
                  type="number"
                  min={0}
                  step={1000}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Lãi suất (%/năm)</label>
                  <input
                    {...register('debtInterestRate', { valueAsNumber: true, min: 0 })}
                    type="number"
                    min={0}
                    step={0.1}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Kỳ hạn (tháng)</label>
                  <input
                    {...register('debtTerm', { valueAsNumber: true, min: 1 })}
                    type="number"
                    min={1}
                    step={1}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Ngày bắt đầu</label>
                <input {...register('debtStartDate')} type="date" style={inputStyle} />
              </div>
            </>
          )}

          <div style={fieldStyle}>
            <label style={labelStyle}>Ghi chú</label>
            <input {...register('note')} style={inputStyle} placeholder="Tuỳ chọn" />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                background: '#fff',
                color: '#374151',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending || (type === 'gold' && goldFormStatusMessage !== null)}
              style={{
                padding: '8px 20px',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: isPending || (type === 'gold' && goldFormStatusMessage !== null) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                opacity: isPending || (type === 'gold' && goldFormStatusMessage !== null) ? 0.7 : 1,
              }}
            >
              {isPending ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
