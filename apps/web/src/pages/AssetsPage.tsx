import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type AssetOverview, type AssetOverviewGroup, type AssetOverviewItem, type AssetType, type UserProfile } from '@pf/shared'
import { apiClient } from '../services/apiClient'
import { formatCurrency, formatDate } from '../utils/format'
import { formatGoldQuantityLabel } from '../utils/gold'
import { useAssetOverview, useDeleteAsset, useRevalueAssets } from '../hooks/useAssets'
import AssetFormModal from '../components/assets/AssetFormModal'
import UpdateValueModal from '../components/assets/UpdateValueModal'
import './assets.css'

type FilterKey = 'all' | 'cash' | 'gold' | 'stock' | 'savings' | 'debt' | 'real_estate'

const TYPE_CONFIG: Record<AssetType, { label: string; icon: string; color: string; soft: string }> = {
  cash: { label: 'Tiền mặt', icon: '▣', color: '#10b981', soft: '#ecfdf5' },
  bank: { label: 'Ngân hàng', icon: '▥', color: '#10b981', soft: '#ecfdf5' },
  gold: { label: 'Vàng', icon: '◉', color: '#f59e0b', soft: '#fffbeb' },
  stock: { label: 'Cổ phiếu', icon: '⌁', color: '#6366f1', soft: '#eef2ff' },
  savings: { label: 'Tiết kiệm', icon: '▤', color: '#06b6d4', soft: '#ecfeff' },
  debt: { label: 'Nợ', icon: '▱', color: '#ef4444', soft: '#fef2f2' },
  real_estate: { label: 'BĐS', icon: '⌂', color: '#ec4899', soft: '#fdf2f8' },
}

const FILTERS: Array<{ key: FilterKey; label: string; types?: AssetType[] }> = [
  { key: 'all', label: 'Tất cả' }, { key: 'cash', label: 'Tiền mặt', types: ['cash', 'bank'] },
  { key: 'gold', label: 'Vàng', types: ['gold'] }, { key: 'stock', label: 'Cổ phiếu', types: ['stock'] },
  { key: 'savings', label: 'Tiết kiệm', types: ['savings'] }, { key: 'debt', label: 'Nợ', types: ['debt'] },
  { key: 'real_estate', label: 'BĐS', types: ['real_estate'] },
]

const GROUP_ORDER: AssetType[] = ['gold', 'stock', 'savings', 'cash', 'debt', 'real_estate']

function compact(value: number, currency: string) {
  const amount = value / 100
  if (currency === 'VND' && Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`
  return formatCurrency(value, currency)
}
function displayDate(value: string) { return value.includes('T') ? formatDate(value) : formatDate(value) }
function percent(value: number | null) { return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%` }
function groupItems(group: AssetOverviewGroup | undefined, bank: AssetOverviewGroup | undefined) { return [...(group?.items ?? []), ...(bank?.items ?? [])] }

function AssetHero({ overview, currency }: { overview: AssetOverview; currency: string }) {
  const deltaPositive = (overview.netWorthDelta ?? 0) >= 0
  return <article className="asset-hero"><div><span className="asset-hero-label">♢ &nbsp;Giá trị tài sản ròng</span><strong>{compact(overview.netWorth, currency)}</strong><span className={`asset-hero-delta ${deltaPositive ? '' : 'negative'}`}>{deltaPositive ? '▲' : '▼'} {compact(Math.abs(overview.netWorthDelta ?? 0), currency)} {overview.netWorthDeltaPercent !== null && `(${percent(overview.netWorthDeltaPercent)})`} so với lần trước</span></div><div className="asset-hero-stats"><div><span>Tổng tài sản</span><b>{compact(overview.totalAssets, currency)}</b></div><div><span>Tổng nợ</span><b className="negative">−{compact(overview.totalDebt, currency)}</b></div><div><span>Lãi/lỗ đầu tư</span><b className={overview.investmentPnl >= 0 ? 'positive' : 'negative'}>{overview.investmentPnl >= 0 ? '+' : '−'}{compact(Math.abs(overview.investmentPnl), currency)}</b></div></div></article>
}

function AllocationCard({ overview, currency }: { overview: AssetOverview; currency: string }) {
  const items = overview.allocation.filter((item) => item.totalValue > 0)
  let cursor = 0
  const gradient = items.length ? `conic-gradient(${items.map((item) => { const start = cursor; cursor += item.percentage; return `${TYPE_CONFIG[item.type]?.color ?? '#94a3b8'} ${start}% ${cursor}%` }).join(', ')})` : '#e5e7ef'
  return <article className="asset-card asset-allocation"><div className="asset-card-head"><div><h2>Phân bổ tài sản</h2><p>Không tính khoản nợ</p></div></div><div className="asset-allocation-content"><div className="asset-donut" style={{ background: gradient }}><div><strong>{compact(overview.totalAssets, currency).replace(/\s?₫$/, 'tr')}</strong><span>tổng tài sản</span></div></div><ul>{items.map((item) => <li key={item.type}><i style={{ background: TYPE_CONFIG[item.type]?.color ?? '#94a3b8' }} /><span>{item.label}</span><b>{compact(item.totalValue, currency).replace(/\s?₫$/, 'tr')}<small>{item.percentage}%</small></b></li>)}</ul></div></article>
}

function HistoryCard({ overview, currency }: { overview: AssetOverview; currency: string }) {
  const [period, setPeriod] = useState<'6' | '12' | 'all'>('12')
  const points = period === '6' ? overview.history.slice(-6) : period === '12' ? overview.history.slice(-12) : overview.history
  if (points.length < 2) return <article className="asset-card asset-history"><div className="asset-card-head"><div><h2>Biến động tài sản ròng</h2><p>Chưa đủ dữ liệu để hiển thị biểu đồ</p></div><PeriodSwitch period={period} setPeriod={setPeriod} /></div><div className="asset-history-empty">Cần ít nhất hai mốc cập nhật tài sản</div></article>
  const values = points.map((point) => point.netWorth); const min = Math.min(...values); const max = Math.max(...values); const spread = Math.max(max - min, 1)
  const coords = values.map((value, index) => `${(index / (values.length - 1)) * 100},${90 - ((value - min) / spread) * 75}`).join(' ')
  return <article className="asset-card asset-history"><div className="asset-card-head"><div><h2>Biến động tài sản ròng</h2><p>Giá trị theo các mốc cập nhật</p></div><PeriodSwitch period={period} setPeriod={setPeriod} /></div><div className="asset-history-summary">{overview.netWorthDelta !== null ? <><span>So với mốc trước:</span><b className={overview.netWorthDelta >= 0 ? 'positive' : 'negative'}>{overview.netWorthDelta >= 0 ? '+' : '−'}{compact(Math.abs(overview.netWorthDelta), currency)} ({percent(overview.netWorthDeltaPercent)})</b></> : 'Chưa có mốc so sánh'}</div><svg className="asset-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Biểu đồ biến động tài sản ròng"><line x1="0" x2="100" y1="15" y2="15" /><line x1="0" x2="100" y1="52" y2="52" /><line x1="0" x2="100" y1="89" y2="89" /><polyline points={`0,100 ${coords} 100,100`} className="area" /><polyline points={coords} className="line" /></svg><div className="asset-chart-labels"><span>{points[0].month}</span><span>{points[Math.floor(points.length / 2)].month}</span><span>{points[points.length - 1].month}</span></div></article>
}

function PeriodSwitch({ period, setPeriod }: { period: string; setPeriod: (period: '6' | '12' | 'all') => void }) { return <div className="asset-period-switch">{(['6', '12', 'all'] as const).map((value) => <button type="button" className={period === value ? 'on' : ''} key={value} onClick={() => setPeriod(value)}>{value === '6' ? '6 tháng' : value === '12' ? '12 tháng' : 'Tất cả'}</button>)}</div> }

function AssetActions({ item, onEdit, onDelete, onUpdate }: { item: AssetOverviewItem; onEdit: (asset: AssetOverviewItem) => void; onDelete: (asset: AssetOverviewItem) => void; onUpdate: (asset: AssetOverviewItem) => void }) { return <span className="asset-row-actions"><button type="button" aria-label={`Sửa ${item.name}`} onClick={() => onEdit(item)}>✎</button>{item.type !== 'gold' && <button type="button" className="update" aria-label={`Cập nhật ${item.name}`} onClick={() => onUpdate(item)}>↻</button>}<button type="button" className="delete" aria-label={`Xóa ${item.name}`} onClick={() => onDelete(item)}>⌫</button></span> }

function Progress({ value }: { value: number | null }) { return <div className="asset-term"><div className="asset-progress"><span style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} /></div><small>{value ?? 0}%</small></div> }

function AssetRow({ item, currency, onEdit, onDelete, onUpdate }: { item: AssetOverviewItem; currency: string; onEdit: (asset: AssetOverviewItem) => void; onDelete: (asset: AssetOverviewItem) => void; onUpdate: (asset: AssetOverviewItem) => void }) {
  const config = TYPE_CONFIG[item.type]; const pnl = item.pnl ?? item.expectedInterest; const negative = (pnl ?? 0) < 0
  const quantity = item.type === 'gold' && item.unit ? formatGoldQuantityLabel(item.unit, item.quantity ?? 0) : item.type === 'stock' ? `${item.quantity ?? 0} cp` : null
  const currentPrice = item.type === 'stock' && item.quantity ? Math.round(item.currentValue / item.quantity) : null
  return <tr><td data-label="Tài sản"><div className="asset-row-name"><span className="asset-row-icon" style={{ background: config.soft, color: config.color }}>{item.type === 'stock' ? item.ticker?.slice(0, 4) : config.icon}</span><div><b>{item.name}</b><small>{item.institution ?? (item.type === 'stock' ? 'HOSE' : item.type === 'cash' ? 'Tiền mặt' : item.type === 'real_estate' ? item.address ?? 'Bất động sản' : item.updatedAt ? `Cập nhật ${displayDate(item.updatedAt)}` : '')}</small></div></div></td>{item.type === 'gold' && <><td data-label="Số lượng">{quantity}</td><td data-label="Giá mua">{item.costBasis ? compact(item.costBasis, currency) : '—'}</td><td data-label="Giá trị"><b>{compact(item.currentValue, currency)}</b></td></>}{item.type === 'stock' && <><td data-label="Số lượng">{quantity}</td><td data-label="Giá TB">{item.costBasis && item.quantity ? compact(Math.round(item.costBasis / item.quantity), currency) : '—'}</td><td data-label="Giá hiện tại">{currentPrice ? compact(currentPrice, currency) : '—'}</td><td data-label="Giá trị"><b>{compact(item.currentValue, currency)}</b></td></>}{item.type === 'savings' && <><td data-label="Lãi suất">{item.interestRate ?? 0}%/năm</td><td data-label="Kỳ hạn"><Progress value={item.progressPercent} /><small>{item.maturityDate ? `→ ${displayDate(item.maturityDate)}` : `${item.termMonths ?? 0} tháng`}</small></td><td data-label="Tiền gốc"><b>{compact(item.currentValue, currency)}</b></td></>}{(item.type === 'cash' || item.type === 'bank') && <><td data-label="Loại">{item.type === 'bank' ? 'Ngân hàng' : 'Tiền mặt'}</td><td data-label="Cập nhật">{displayDate(item.updatedAt)}</td><td data-label="Số dư"><b>{compact(item.currentValue, currency)}</b></td></>}{item.type === 'debt' && <><td data-label="Lãi suất">{item.interestRate ?? 0}%/năm</td><td data-label="Đã trả"><Progress value={item.progressPercent} /></td><td data-label="Còn nợ"><b className="negative">−{compact(item.currentValue, currency)}</b></td></>}{item.type === 'real_estate' && <><td data-label="Địa chỉ">{item.address ?? '—'}</td><td data-label="Giá trị"><b>{compact(item.currentValue, currency)}</b></td></>}<td data-label="Lãi / lỗ" className="asset-pnl">{pnl !== null && <b className={negative ? 'negative' : 'positive'}>{pnl >= 0 ? '+' : '−'}{compact(Math.abs(pnl), currency)}<small>{percent(item.pnlPercent)}</small></b>}</td><td><AssetActions item={item} onEdit={onEdit} onDelete={onDelete} onUpdate={onUpdate} /></td></tr>
}

function GroupCard({ group, items, currency, goldPrice, onAdd, onEdit, onDelete, onUpdate }: { group: AssetType; items: AssetOverviewItem[]; currency: string; goldPrice: number | null; onAdd: () => void; onEdit: (asset: AssetOverviewItem) => void; onDelete: (asset: AssetOverviewItem) => void; onUpdate: (asset: AssetOverviewItem) => void }) {
  const config = TYPE_CONFIG[group]; const total = items.reduce((sum, item) => sum + item.currentValue, 0) * (group === 'debt' ? -1 : 1); const pnl = items.reduce((sum, item) => sum + (item.pnl ?? item.expectedInterest ?? 0), 0); const first = items[0]
  const renderType = group === 'cash' ? items.some((item) => item.type === 'bank') ? 'cash' : 'cash' : group
  return <article className="asset-group"><header className="asset-group-head"><span className="asset-group-icon" style={{ background: config.color }}>{config.icon}</span><div><h2>{config.label === 'BĐS' ? 'Bất động sản' : group === 'cash' ? 'Tiền mặt & ngân hàng' : config.label}</h2><p>{items.length ? `${items.length} tài sản · ${group === 'savings' && first?.maturityDate ? 'theo dõi kỳ hạn' : group === 'cash' ? 'tự cập nhật theo giao dịch' : 'cập nhật theo giá trị hiện tại'}` : 'Chưa có tài sản'}</p></div><span className="asset-group-spacer" />{group === 'gold' && <div className="asset-price-pill">Giá vàng hiện tại <b>theo Cài đặt</b></div>}<div className="asset-group-total"><b className={group === 'debt' ? 'negative' : ''}>{group === 'debt' ? '−' : ''}{compact(Math.abs(total), currency)}</b>{pnl !== 0 && <span className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : '−'}{compact(Math.abs(pnl), currency)} {first?.pnlPercent !== null && first?.pnlPercent !== undefined && `(${percent(first.pnlPercent)})`}</span>}</div>{!items.length && <button type="button" className="asset-add-inline" onClick={onAdd}>＋ Thêm</button>}</header>{items.length > 0 && <div className="asset-table-scroll"><table className={`asset-table asset-table-${renderType}`}><thead><tr><th>Tài sản</th><th>{group === 'gold' ? 'Số lượng' : group === 'stock' ? 'Số lượng' : group === 'savings' ? 'Lãi suất' : group === 'debt' ? 'Lãi suất' : group === 'cash' ? 'Loại' : 'Địa chỉ'}</th><th>{group === 'gold' ? 'Giá mua' : group === 'stock' ? 'Giá TB' : group === 'savings' ? 'Kỳ hạn' : group === 'debt' ? 'Đã trả' : group === 'cash' ? 'Cập nhật' : 'Giá trị'}</th><th>{group === 'gold' ? 'Giá trị hiện tại' : group === 'stock' ? 'Giá hiện tại' : group === 'savings' ? 'Tiền gốc' : group === 'debt' ? 'Còn nợ' : group === 'cash' ? 'Số dư' : ''}</th>{group === 'stock' && <><th>Giá trị</th><th>Lãi / lỗ</th></>}{group === 'gold' && <th>Lãi / lỗ</th>}{group !== 'stock' && group !== 'gold' && <th>Lãi / lỗ</th>}<th /></tr></thead><tbody>{items.map((item) => <AssetRow key={item.id} item={item} currency={currency} onEdit={onEdit} onDelete={onDelete} onUpdate={onUpdate} />)}</tbody></table></div>}</article>
}

export default function AssetsPage() {
  const [filter, setFilter] = useState<FilterKey>('all'); const [formOpen, setFormOpen] = useState(false); const [formDefault, setFormDefault] = useState<AssetType>('cash'); const [editing, setEditing] = useState<AssetOverviewItem | null>(null); const [updating, setUpdating] = useState<AssetOverviewItem | null>(null); const [message, setMessage] = useState('')
  const { data: overviewRes, isLoading, error } = useAssetOverview(); const overview = overviewRes?.data
  const { data: profileRes } = useQuery({ queryKey: QUERY_KEYS.profile, queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile') }); const currency = profileRes?.data?.currency ?? 'VND'
  const deleteAsset = useDeleteAsset(); const revalue = useRevalueAssets()
  const groups = overview?.groups ?? []
  const visibleTypes = FILTERS.find((item) => item.key === filter)?.types
  const displayGroups = useMemo(() => GROUP_ORDER.map((type) => ({ type, items: type === 'cash' ? groupItems(groups.find((group) => group.type === 'cash'), groups.find((group) => group.type === 'bank')) : groups.find((group) => group.type === type)?.items ?? [] })).filter((group) => !visibleTypes || visibleTypes.includes(group.type) || (group.type === 'cash' && visibleTypes.includes('bank'))), [groups, visibleTypes])
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0)
  const openAdd = (type: AssetType = filter === 'all' || filter === 'cash' ? 'cash' : filter) => { setEditing(null); setFormDefault(type); setFormOpen(true) }
  const edit = (asset: AssetOverviewItem) => { setFormOpen(false); setEditing(asset) }
  const remove = (asset: AssetOverviewItem) => { if (window.confirm(`Xóa "${asset.name}"?`)) deleteAsset.mutate(asset.id) }
  const update = (asset: AssetOverviewItem) => setUpdating(asset)
  const refresh = () => { setMessage(''); revalue.mutate(undefined, { onSuccess: () => setMessage('Đã cập nhật lại giá trị vàng'), onError: (cause) => setMessage(cause instanceof Error ? cause.message : 'Không thể cập nhật giá') }) }

  if (isLoading || !overview) return <div className="asset-page"><header className="asset-topbar"><div><h1>Tài sản</h1><p>Đang tải dữ liệu tài sản...</p></div></header><div className="asset-loading"><i /><i /><i /></div></div>
  if (error) return <div className="asset-page"><header className="asset-topbar"><div><h1>Tài sản</h1><p>Không thể tải dữ liệu</p></div></header><div className="asset-error">Có lỗi khi tải tài sản. Vui lòng thử lại.</div></div>

  return <div className="asset-page"><header className="asset-topbar"><div><h1>Tài sản</h1><p>Theo dõi giá trị tài sản ròng và hiệu quả đầu tư</p></div><div className="asset-top-actions"><button type="button" className="asset-button" onClick={refresh} disabled={revalue.isPending}>↻ <span>{revalue.isPending ? 'Đang cập nhật...' : 'Cập nhật giá'}</span></button><button type="button" className="asset-button primary" onClick={() => openAdd()}>＋ <span>Thêm tài sản</span></button></div></header><main className="asset-content"><AssetHero overview={overview} currency={currency} /><div className="asset-chart-grid"><AllocationCard overview={overview} currency={currency} /><HistoryCard overview={overview} currency={currency} /></div><div className="asset-filter-bar">{FILTERS.map((item) => { const count = item.key === 'all' ? totalCount : groups.filter((group) => item.types?.includes(group.type)).reduce((sum, group) => sum + group.count, 0); const amount = item.key === 'all' ? overview.totalAssets : groups.filter((group) => item.types?.includes(group.type)).reduce((sum, group) => sum + group.totalValue, 0); return <button type="button" className={`asset-filter-chip ${filter === item.key ? 'on' : ''}`} key={item.key} onClick={() => setFilter(item.key)}><span style={{ background: item.key === 'all' ? '#eef2ff' : TYPE_CONFIG[item.types?.[0] ?? 'cash'].soft, color: item.key === 'all' ? '#4f46e5' : TYPE_CONFIG[item.types?.[0] ?? 'cash'].color }}>{item.key === 'all' ? '▦' : TYPE_CONFIG[item.types?.[0] ?? 'cash'].icon}</span>{item.label}<b>{count}</b><small>{compact(amount, currency).replace(/\s?₫$/, 'tr')}</small></button> })}</div>{message && <p className="asset-message">{message}</p>}{displayGroups.map(({ type, items }) => <GroupCard key={type} group={type} items={items} currency={currency} goldPrice={overview.goldPricePerLuong} onAdd={() => openAdd(type)} onEdit={edit} onDelete={remove} onUpdate={update} />)}<p className="asset-footnote">Giá trị được tổng hợp từ dữ liệu tài sản và các giao dịch đã ghi nhận.</p></main><AssetFormModal isOpen={formOpen || Boolean(editing)} onClose={() => { setFormOpen(false); setEditing(null) }} asset={editing} defaultTab={formDefault} /><UpdateValueModal isOpen={Boolean(updating)} onClose={() => setUpdating(null)} asset={updating} /></div>
}
