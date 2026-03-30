import { useEffect, useMemo, useState } from 'react'
import { type Asset, QUERY_KEYS } from '@pf/shared'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '../../utils/format'
import { parseGoldMetadata } from '../../utils/gold'
import { apiClient } from '../../services/apiClient'

interface Props {
  goldAssets: Asset[]
  goldPricePerLuong: number | null
}

function getGoldHoldingsSummary(goldAssets: Asset[]): string {
  let totalLuong = 0
  let totalChi = 0

  for (const asset of goldAssets) {
    const metadata = parseGoldMetadata(asset.metadata)
    if (!metadata) continue
    if (metadata.unit === 'luong') totalLuong += metadata.quantity
    else totalChi += metadata.quantity
  }

  if (totalLuong === 0 && totalChi === 0) return 'Chưa có dữ liệu số lượng'
  if (totalLuong === 0) return `${totalChi} chỉ`
  if (totalChi === 0) return `${totalLuong} lượng`
  return `${totalLuong} lượng + ${totalChi} chỉ`
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '14px',
  background: '#f8fafc',
}

export default function GoldOverviewCard({ goldAssets, goldPricePerLuong }: Props) {
  const queryClient = useQueryClient()
  const [inputPriceDisplay, setInputPriceDisplay] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    setInputPriceDisplay(goldPricePerLuong ? String(goldPricePerLuong / 100) : '')
  }, [goldPricePerLuong])

  const totalGoldValue = useMemo(
    () => goldAssets.reduce((sum, asset) => sum + asset.currentValue, 0),
    [goldAssets],
  )

  const holdingSummary = useMemo(
    () => getGoldHoldingsSummary(goldAssets),
    [goldAssets],
  )

  const hasConfiguredPrice = goldPricePerLuong != null && goldPricePerLuong > 0

  async function handleSave() {
    const numericPrice = Number(inputPriceDisplay)
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setSaveStatus('error')
      return
    }

    setIsSaving(true)
    setSaveStatus('idle')

    try {
      await apiClient('/settings/profile', {
        method: 'PUT',
        body: { goldPricePerLuong: Math.round(numericPrice * 100) },
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assets }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports }),
      ])

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      style={{
        ...cardStyle,
        borderColor: hasConfiguredPrice ? '#dbeafe' : '#fbcfe8',
        background: hasConfiguredPrice ? '#f8fafc' : '#fff7ed',
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
        Tổng quan vàng
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Giá 1 lượng hiện tại</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: hasConfiguredPrice ? '#0f172a' : '#c2410c' }}>
            {hasConfiguredPrice ? formatCurrency(goldPricePerLuong) : 'Chưa cấu hình'}
          </div>

          <div style={{ marginTop: '10px', fontSize: '13px', color: '#334155' }}>
            <div>Tổng nắm giữ: {holdingSummary}</div>
            <div style={{ marginTop: '4px' }}>Tổng giá trị vàng: {formatCurrency(totalGoldValue)}</div>
          </div>

          {!hasConfiguredPrice && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#c2410c' }}>
              Chưa cấu hình nên giá trị vàng có thể chưa chính xác.
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <label
            htmlFor="goldPricePerLuongInput"
            style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}
          >
            Cập nhật giá 1 lượng vàng (VND)
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="goldPricePerLuongInput"
              type="number"
              min={0}
              step={1000}
              value={inputPriceDisplay}
              onChange={(event) => setInputPriceDisplay(event.target.value)}
              style={{
                flex: '1 1 180px',
                minWidth: '180px',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#0f172a',
                background: '#fff',
              }}
              placeholder="VD: 95,000,000"
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderRadius: '8px',
                background: '#4f46e5',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>

          {saveStatus === 'success' && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#15803d' }}>Đã cập nhật giá vàng</div>
          )}
          {saveStatus === 'error' && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
              Lưu thất bại hoặc giá không hợp lệ
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
