import { useState } from 'react'
import type { Asset, AssetType } from '@pf/shared'
import { formatCurrency } from '../utils/format'
import { useAssets, useNetWorth, useNetWorthHistory, useDeleteAsset } from '../hooks/useAssets'
import AssetPieChart from '../components/assets/AssetPieChart'
import NetWorthChart from '../components/assets/NetWorthChart'
import AssetList from '../components/assets/AssetList'
import AssetFormModal from '../components/assets/AssetFormModal'
import UpdateValueModal from '../components/assets/UpdateValueModal'

const TAB_TYPES: Record<string, string[]> = {
  cash: ['cash', 'bank'],
  gold: ['gold'],
  stock: ['stock'],
  savings: ['savings'],
  debt: ['debt'],
  real_estate: ['real_estate'],
}

const TABS = [
  { key: 'cash', label: '💵 Tiền mặt' },
  { key: 'gold', label: '🥇 Vàng' },
  { key: 'stock', label: '📈 Cổ phiếu' },
  { key: 'savings', label: '🏛️ Tiết kiệm' },
  { key: 'debt', label: '💳 Nợ' },
  { key: 'real_estate', label: '🏠 BĐS' },
]

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
}

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState<string>('cash')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [updatingAsset, setUpdatingAsset] = useState<Asset | null>(null)

  const { data: allAssetsResp } = useAssets()
  const { data: netWorthResp } = useNetWorth()
  const { data: historyResp } = useNetWorthHistory()
  const deleteAsset = useDeleteAsset()

  const allAssets = allAssetsResp?.data ?? []
  const netWorthData = netWorthResp?.data
  const history = historyResp?.data ?? []

  const filteredAssets = allAssets.filter((a) => TAB_TYPES[activeTab]?.includes(a.type))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '8px' }}>Giá trị tài sản ròng</div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: 800,
            color: (netWorthData?.netWorth ?? 0) >= 0 ? '#86efac' : '#fca5a5',
          }}
        >
          {formatCurrency(netWorthData?.netWorth ?? 0)}
        </div>
        <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '11px', opacity: 0.85 }}>
          <span>Tổng tài sản: {formatCurrency(netWorthData?.totalAssets ?? 0)}</span>
          <span>Tổng nợ: {formatCurrency(netWorthData?.totalDebt ?? 0)}</span>
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
            Phân bổ tài sản
          </div>
          <AssetPieChart data={netWorthData?.byType ?? []} />
        </div>
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
            Biến động Net Worth
          </div>
          <NetWorthChart data={history} />
        </div>
      </div>

      {/* Asset list card */}
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Danh sách tài sản</span>
          <button onClick={() => setIsAddModalOpen(true)} style={primaryBtnStyle}>
            + Thêm tài sản
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '16px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '0',
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#4f46e5' : '#64748b',
                borderBottom: activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AssetList
          assets={filteredAssets}
          onEdit={setEditingAsset}
          onDelete={(asset) => {
            if (confirm(`Xóa "${asset.name}"?`)) deleteAsset.mutate(asset.id)
          }}
          onUpdateValue={setUpdatingAsset}
        />
      </div>

      <AssetFormModal
        isOpen={isAddModalOpen || !!editingAsset}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingAsset(null)
        }}
        asset={editingAsset}
        defaultTab={activeTab as AssetType}
      />
      <UpdateValueModal
        isOpen={!!updatingAsset}
        onClose={() => setUpdatingAsset(null)}
        asset={updatingAsset}
      />
    </div>
  )
}
