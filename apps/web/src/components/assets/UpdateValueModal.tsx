import { useEffect, useState } from 'react'
import type { Asset } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import { useUpdateAssetValue } from '../../hooks/useAssets'

interface Props {
  isOpen: boolean
  onClose: () => void
  asset: Asset | null
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

export default function UpdateValueModal({ isOpen, onClose, asset }: Props) {
  const [display, setDisplay] = useState<number>(0)
  const mutation = useUpdateAssetValue()

  useEffect(() => {
    if (isOpen && asset) {
      setDisplay(asset.currentValue / 100)
    }
  }, [isOpen, asset])

  if (!isOpen || !asset) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!asset) return
    await mutation.mutateAsync({ id: asset.id, newValue: Math.round(display * 100) })
    onClose()
  }

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
          width: '360px',
          maxWidth: '90vw',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            Cập nhật giá trị
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{asset.name}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Giá trị hiện tại: {formatCurrency(asset.currentValue)}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}
            >
              Giá trị mới (VND)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={display}
              onChange={(e) => setDisplay(Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
              disabled={mutation.isPending}
              style={{
                padding: '8px 20px',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                opacity: mutation.isPending ? 0.7 : 1,
              }}
            >
              {mutation.isPending ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
