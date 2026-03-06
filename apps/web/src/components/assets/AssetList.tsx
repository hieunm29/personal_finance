import type { Asset } from '@pf/shared'
import { formatCurrency, formatDate } from '../../utils/format'

const ICONS: Record<string, string> = {
  cash: '💵',
  bank: '🏦',
  gold: '🥇',
  stock: '📈',
  savings: '🏛️',
  real_estate: '🏠',
  debt: '💳',
}

interface Props {
  assets: Asset[]
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
  onUpdateValue: (asset: Asset) => void
}

function getSubText(asset: Asset): string {
  const meta = asset.metadata ? (JSON.parse(asset.metadata) as Record<string, unknown>) : null
  switch (asset.type) {
    case 'cash':
      return 'Tiền mặt'
    case 'bank':
      return (meta?.bankName as string) ?? 'Ngân hàng'
    case 'gold': {
      const qty = (meta?.quantity as number) ?? 0
      const unit = (meta?.unit as string) === 'chi' ? 'Chỉ' : 'Lượng'
      const buyPrice = (meta?.buyPrice as number) ?? 0
      return `${qty} ${unit} | Giá mua: ${formatCurrency(buyPrice)}`
    }
    case 'stock': {
      const ticker = (meta?.ticker as string) ?? ''
      const qty = (meta?.quantity as number) ?? 0
      const avgBuyPrice = (meta?.avgBuyPrice as number) ?? 0
      return `${ticker} | SL: ${qty} | Giá TB: ${formatCurrency(avgBuyPrice)}`
    }
    case 'savings': {
      const bankName = (meta?.bankName as string) ?? ''
      const depositDate = (meta?.depositDate as string) ?? ''
      const term = (meta?.term as number) ?? 0
      let maturityText = ''
      if (depositDate) {
        const d = new Date(`${depositDate}T00:00:00`)
        d.setMonth(d.getMonth() + term)
        maturityText = ` | Đáo hạn: ${formatDate(d.toLocaleDateString('sv'))}`
      }
      return `${bankName}${maturityText}`
    }
    case 'real_estate':
      return (meta?.address as string) || 'Bất động sản'
    case 'debt': {
      const originalAmount = (meta?.originalAmount as number) ?? 0
      const interestRate = (meta?.interestRate as number) ?? 0
      const term = (meta?.term as number) ?? 0
      return `${formatCurrency(originalAmount)} gốc | ${interestRate}%/năm | ${term} tháng`
    }
    default:
      return ''
  }
}

function PnLDisplay({ asset }: { asset: Asset }) {
  const meta = asset.metadata ? (JSON.parse(asset.metadata) as Record<string, unknown>) : null

  if (asset.type === 'gold') {
    const qty = (meta?.quantity as number) ?? 0
    const buyPrice = (meta?.buyPrice as number) ?? 0
    const costBasis = qty * buyPrice
    const pnl = asset.currentValue - costBasis
    if (!costBasis) return null
    const color = pnl >= 0 ? '#16a34a' : '#dc2626'
    const sign = pnl >= 0 ? '+' : ''
    return (
      <div style={{ fontSize: '12px', color, marginTop: '2px' }}>
        {sign}{formatCurrency(pnl)}
      </div>
    )
  }

  if (asset.type === 'stock') {
    const qty = (meta?.quantity as number) ?? 0
    const avgBuyPrice = (meta?.avgBuyPrice as number) ?? 0
    const costBasis = qty * avgBuyPrice
    const pnl = asset.currentValue - costBasis
    if (!costBasis) return null
    const color = pnl >= 0 ? '#16a34a' : '#dc2626'
    const sign = pnl >= 0 ? '+' : ''
    const pnlPercent = ((pnl / costBasis) * 100).toFixed(1)
    return (
      <div style={{ fontSize: '12px', color, marginTop: '2px' }}>
        {sign}{formatCurrency(pnl)} ({sign}{pnlPercent}%)
      </div>
    )
  }

  if (asset.type === 'savings') {
    const meta2 = asset.metadata ? (JSON.parse(asset.metadata) as Record<string, unknown>) : null
    const depositAmount = (meta2?.depositAmount as number) ?? 0
    const interestRate = (meta2?.interestRate as number) ?? 0
    const term = (meta2?.term as number) ?? 0
    const expectedInterest = depositAmount * (interestRate / 100) * (term / 12)

    const depositDate = (meta2?.depositDate as string) ?? ''
    let maturityBadge: React.ReactNode = null
    if (depositDate && term) {
      const d = new Date(`${depositDate}T00:00:00`)
      d.setMonth(d.getMonth() + term)
      const now = new Date()
      const daysUntil = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil <= 0) {
        maturityBadge = (
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '4px',
              background: '#fee2e2',
              color: '#dc2626',
              marginLeft: '6px',
            }}
          >
            Đã đáo hạn
          </span>
        )
      } else if (daysUntil <= 7) {
        maturityBadge = (
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '4px',
              background: '#fef3c7',
              color: '#d97706',
              marginLeft: '6px',
            }}
          >
            Sắp đáo hạn ({daysUntil} ngày)
          </span>
        )
      }
    }

    return (
      <div style={{ marginTop: '2px' }}>
        {expectedInterest > 0 && (
          <span style={{ fontSize: '12px', color: '#16a34a' }}>
            Lãi dự kiến: +{formatCurrency(Math.round(expectedInterest))}
          </span>
        )}
        {maturityBadge}
      </div>
    )
  }

  return null
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  padding: '4px',
  borderRadius: '4px',
  lineHeight: 1,
}

export default function AssetList({ assets, onEdit, onDelete, onUpdateValue }: Props) {
  if (assets.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px',
          color: '#94a3b8',
          fontSize: '14px',
        }}
      >
        Chưa có tài sản nào
      </div>
    )
  }

  return (
    <div>
      {assets.map((asset) => {
        const showUpdatedAt = asset.updatedAt !== asset.createdAt
        const isDebt = asset.type === 'debt'

        return (
          <div
            key={asset.id}
            className="asset-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div
              className="asset-icon"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              {ICONS[asset.type] ?? '💼'}
            </div>

            <div className="asset-info" style={{ flex: 1, minWidth: 0 }}>
              <div
                className="asset-name"
                style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}
              >
                {asset.name}
              </div>
              <div
                className="asset-sub"
                style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}
              >
                {getSubText(asset)}
              </div>
              <PnLDisplay asset={asset} />
              {showUpdatedAt && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Cập nhật: {formatDate(asset.updatedAt)}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: isDebt ? '#dc2626' : '#0f172a',
                }}
              >
                {isDebt ? '-' : ''}{formatCurrency(asset.currentValue)}
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
                <button onClick={() => onEdit(asset)} style={btnStyle} title="Sửa">
                  ✏️
                </button>
                <button onClick={() => onUpdateValue(asset)} style={btnStyle} title="Cập nhật giá">
                  🔄
                </button>
                <button onClick={() => onDelete(asset)} style={btnStyle} title="Xóa">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
