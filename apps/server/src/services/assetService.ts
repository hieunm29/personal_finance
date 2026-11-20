import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db'
import { assets, assetHistory, userProfiles } from '../db/schema'
import type { CreateAssetInput, UpdateAssetInput } from '@pf/shared'
import type {
  Asset,
  AssetOverview,
  AssetOverviewGroup,
  AssetOverviewItem,
  AssetType,
  NetWorthData,
  NetWorthHistoryPoint,
  AssetAllocationItem,
} from '@pf/shared'
import {
  assertGoldManualValueUpdateAllowed,
  buildGoldRevaluationUpdates,
  calculateGoldAssetValue,
  parseGoldMetadata,
  serializeGoldMetadata,
} from './goldValuation'

const TYPE_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  gold: 'Vàng',
  stock: 'Cổ phiếu',
  savings: 'Tiết kiệm',
  real_estate: 'Bất động sản',
  debt: 'Nợ',
}

const ASSET_TYPE_ORDER: AssetType[] = ['gold', 'stock', 'savings', 'cash', 'bank', 'debt', 'real_estate']

function getProfileId(authUserId: string): string {
  const p = db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.authUserId, authUserId)).get()
  if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return p.id
}

function getProfileSettings(authUserId: string) {
  const profile = db
    .select({
      id: userProfiles.id,
      goldPricePerLuong: userProfiles.goldPricePerLuong,
    })
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()

  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 })

  return profile
}

function asBadRequest(error: unknown): never {
  if (error instanceof Error) {
    throw Object.assign(new Error(error.message), { status: 400 })
  }

  throw Object.assign(new Error('Yêu cầu không hợp lệ'), { status: 400 })
}

export function getAssets(authUserId: string, type?: string): Asset[] {
  const profileId = getProfileId(authUserId)
  const condition = type
    ? sql`${assets.userId} = ${profileId} AND ${assets.type} = ${type}`
    : eq(assets.userId, profileId)
  const rows = db.select().from(assets).where(condition).orderBy(desc(assets.createdAt)).all()
  return rows as unknown as Asset[]
}

export function createAsset(authUserId: string, data: CreateAssetInput): Asset {
  const profile = getProfileSettings(authUserId)
  let currentValue = data.currentValue ?? 0
  let metadata = data.metadata ?? null

  if (data.type === 'gold') {
    try {
      if (data.currentValue !== undefined) {
        throw new Error('Tài sản vàng được định giá tự động từ đơn vị và số lượng')
      }
      const goldMetadata = parseGoldMetadata(data.metadata)
      currentValue = calculateGoldAssetValue(goldMetadata, profile.goldPricePerLuong)
      metadata = serializeGoldMetadata(goldMetadata)
    } catch (error) {
      asBadRequest(error)
    }
  }

  const id = crypto.randomUUID()
  db.insert(assets).values({
    id,
    userId: profile.id,
    type: data.type,
    name: data.name,
    currentValue,
    metadata,
    note: data.note ?? null,
  }).run()
  return db.select().from(assets).where(eq(assets.id, id)).get()! as unknown as Asset
}

export function updateAsset(authUserId: string, assetId: string, data: UpdateAssetInput): Asset {
  const profile = getProfileSettings(authUserId)
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!asset || asset.userId !== profile.id) {
    throw Object.assign(new Error('Asset not found'), { status: 404 })
  }

  const setFields: Record<string, unknown> = { updatedAt: sql`(datetime('now'))` }
  const nextType = data.type ?? asset.type

  if (data.type !== undefined) setFields.type = data.type
  if (data.name !== undefined) setFields.name = data.name
  if (data.note !== undefined) setFields.note = data.note

  if (nextType === 'gold') {
    try {
      if (data.currentValue !== undefined) {
        throw new Error('Tài sản vàng được định giá tự động từ đơn vị và số lượng')
      }
      const goldMetadata = parseGoldMetadata(data.metadata ?? asset.metadata)
      setFields.metadata = serializeGoldMetadata(goldMetadata)
      setFields.currentValue = calculateGoldAssetValue(goldMetadata, profile.goldPricePerLuong)
    } catch (error) {
      asBadRequest(error)
    }
  } else {
    if (data.currentValue !== undefined) setFields.currentValue = data.currentValue
    if (data.metadata !== undefined) setFields.metadata = data.metadata
  }

  db.update(assets).set(setFields).where(eq(assets.id, assetId)).run()
  return db.select().from(assets).where(eq(assets.id, assetId)).get()! as unknown as Asset
}

export function deleteAsset(authUserId: string, assetId: string): void {
  const profileId = getProfileId(authUserId)
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!asset || asset.userId !== profileId) {
    throw Object.assign(new Error('Asset not found'), { status: 404 })
  }
  db.delete(assets).where(eq(assets.id, assetId)).run()
}

export function getNetWorth(authUserId: string): NetWorthData {
  const profileId = getProfileId(authUserId)
  const rows = db.select().from(assets).where(eq(assets.userId, profileId)).all()

  let totalAssets = 0
  let totalDebt = 0

  for (const row of rows) {
    if (row.type === 'debt') {
      totalDebt += row.currentValue
    } else {
      totalAssets += row.currentValue
    }
  }

  const netWorth = totalAssets - totalDebt

  // Group non-debt assets by type
  const typeMap = new Map<string, number>()
  for (const row of rows) {
    if (row.type === 'debt') continue
    typeMap.set(row.type, (typeMap.get(row.type) ?? 0) + row.currentValue)
  }

  const byType: AssetAllocationItem[] = Array.from(typeMap.entries()).map(([type, totalValue]) => ({
    type: type as Asset['type'],
    label: TYPE_LABELS[type] ?? type,
    totalValue,
    percentage: totalAssets > 0 ? Math.round((totalValue / totalAssets) * 100) : 0,
  }))

  return { netWorth, totalAssets, totalDebt, byType }
}

export function updateAssetValue(authUserId: string, assetId: string, newValue: number): Asset {
  const profileId = getProfileId(authUserId)
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!asset || asset.userId !== profileId) {
    throw Object.assign(new Error('Asset not found'), { status: 404 })
  }

  try {
    assertGoldManualValueUpdateAllowed(asset.type)
  } catch (error) {
    asBadRequest(error)
  }

  db.update(assets).set({ currentValue: newValue, updatedAt: sql`(datetime('now'))` }).where(eq(assets.id, assetId)).run()

  db.insert(assetHistory).values({
    id: crypto.randomUUID(),
    assetId,
    value: newValue,
    date: new Date().toLocaleDateString('sv'),
  }).run()

  return db.select().from(assets).where(eq(assets.id, assetId)).get()! as unknown as Asset
}

export function revalueGoldAssetsForProfile(profileId: string, goldPricePerLuong: number): void {
  const goldAssets = db
    .select({
      id: assets.id,
      metadata: assets.metadata,
    })
    .from(assets)
    .where(sql`${assets.userId} = ${profileId} AND ${assets.type} = 'gold'`)
    .all()

  if (goldAssets.length === 0) return

  const updates = buildGoldRevaluationUpdates(goldAssets, goldPricePerLuong)
  const today = new Date().toLocaleDateString('sv')

  for (const update of updates) {
    db.update(assets)
      .set({
        currentValue: update.currentValue,
        metadata: update.metadata,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(assets.id, update.id))
      .run()

    db.insert(assetHistory)
      .values({
        id: crypto.randomUUID(),
        assetId: update.id,
        value: update.currentValue,
        date: today,
      })
      .run()
  }
}

export function getNetWorthHistory(authUserId: string, limit?: number): NetWorthHistoryPoint[] {
  const profileId = getProfileId(authUserId)

  const rows = db.select({
    assetId: assetHistory.assetId,
    date: assetHistory.date,
    value: assetHistory.value,
    type: assets.type,
  }).from(assetHistory)
    .innerJoin(assets, eq(assetHistory.assetId, assets.id))
    .where(eq(assets.userId, profileId))
    .orderBy(assetHistory.date, assetHistory.createdAt, sql`asset_history.rowid`)
    .all()

  if (rows.length === 0) return []

  const values = new Map<string, number>()
  const result: NetWorthHistoryPoint[] = []
  const cursor = new Date(`${rows[0].date.slice(0, 7)}-01T00:00:00Z`)
  const lastMonth = new Date(`${rows[rows.length - 1].date.slice(0, 7)}-01T00:00:00Z`)
  let netWorth = 0
  let index = 0
  while (cursor <= lastMonth) {
    const month = cursor.toISOString().slice(0, 7)
    while (index < rows.length && rows[index].date.slice(0, 7) === month) {
      const row = rows[index++]
      const value = row.type === 'debt' ? -row.value : row.value
      netWorth += value - (values.get(row.assetId) ?? 0)
      values.set(row.assetId, value)
    }
    result.push({ month, netWorth })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return limit ? result.slice(-limit) : result
}

function readMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function dateValue(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function addMonths(date: string | null, months: number | null): string | null {
  if (!date || months === null) return null
  const result = new Date(`${date}T00:00:00`)
  if (Number.isNaN(result.getTime())) return null
  result.setMonth(result.getMonth() + months)
  return result.toLocaleDateString('sv')
}

function buildAssetOverviewItem(row: typeof assets.$inferSelect): AssetOverviewItem {
  const metadata = readMetadata(row.metadata)
  const quantity = numberValue(metadata.quantity)
  const avgBuyPrice = numberValue(metadata.avgBuyPrice)
  const purchaseAmount = numberValue(metadata.purchaseAmount)
  const depositAmount = numberValue(metadata.depositAmount)
  const interestRate = numberValue(metadata.interestRate)
  const termMonths = numberValue(metadata.term)
  const startDate = dateValue(metadata.depositDate) ?? dateValue(metadata.startDate)
  const costBasis = row.type === 'stock' && quantity !== null && avgBuyPrice !== null
    ? Math.round(quantity * avgBuyPrice)
    : row.type === 'gold'
      ? purchaseAmount
      : row.type === 'savings'
        ? depositAmount
        : null
  const expectedInterest = row.type === 'savings' && depositAmount !== null && interestRate !== null && termMonths !== null
    ? Math.round(depositAmount * (interestRate / 100) * (termMonths / 12))
    : null
  const pnl = row.type === 'savings'
    ? expectedInterest
    : costBasis !== null && row.type !== 'debt'
      ? row.currentValue - costBasis
      : null
  const pnlPercent = pnl !== null && costBasis && costBasis > 0 ? Math.round((pnl / costBasis) * 1000) / 10 : null
  const originalAmount = row.type === 'debt' ? numberValue(metadata.originalAmount) : null
  const paidAmount = originalAmount !== null ? Math.max(0, originalAmount - row.currentValue) : null
  const progressPercent = row.type === 'debt' && originalAmount && originalAmount > 0
    ? Math.min(100, Math.round((paidAmount! / originalAmount) * 100))
    : row.type === 'savings' && startDate && termMonths && termMonths > 0
      ? Math.min(100, Math.max(0, Math.round(((Date.now() - new Date(`${startDate}T00:00:00`).getTime()) / (termMonths * 30.4375 * 24 * 60 * 60 * 1000)) * 100)))
      : null

  return {
    ...row,
    type: row.type as AssetType,
    label: TYPE_LABELS[row.type] ?? row.type,
    institution: typeof metadata.bankName === 'string' ? metadata.bankName : null,
    address: typeof metadata.address === 'string' ? metadata.address : null,
    ticker: typeof metadata.ticker === 'string' ? metadata.ticker : null,
    quantity,
    unit: row.type === 'gold' && (metadata.unit === 'phan' || metadata.unit === 'chi' || metadata.unit === 'luong') ? metadata.unit : null,
    costBasis,
    pnl,
    pnlPercent,
    interestRate,
    termMonths,
    startDate,
    maturityDate: addMonths(startDate, termMonths),
    expectedInterest,
    originalAmount,
    paidAmount,
    progressPercent,
  }
}

function buildAssetOverviewGroups(items: AssetOverviewItem[]): AssetOverviewGroup[] {
  const byType = new Map<AssetType, AssetOverviewItem[]>()
  for (const item of items) byType.set(item.type, [...(byType.get(item.type) ?? []), item])

  return ASSET_TYPE_ORDER.filter((type) => byType.has(type)).map((type) => {
    const groupItems = byType.get(type)!
    const totalValue = groupItems.reduce((sum, item) => sum + item.currentValue, 0) * (type === 'debt' ? -1 : 1)
    const pnlValues = groupItems.map((item) => item.pnl).filter((value): value is number => value !== null)
    const costBasis = groupItems.reduce((sum, item) => sum + (item.costBasis ?? 0), 0)
    const pnl = pnlValues.length > 0 ? pnlValues.reduce((sum, value) => sum + value, 0) : null
    return {
      type,
      label: TYPE_LABELS[type] ?? type,
      count: groupItems.length,
      totalValue,
      pnl,
      pnlPercent: pnl !== null && costBasis > 0 ? Math.round((pnl / costBasis) * 1000) / 10 : null,
      expectedInterest: groupItems.reduce((sum, item) => sum + (item.expectedInterest ?? 0), 0) || null,
      items: groupItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }
  })
}

export function getAssetOverview(authUserId: string): AssetOverview {
  const profileId = getProfileId(authUserId)
  const profile = getProfileSettings(authUserId)
  const rows = db.select().from(assets).where(eq(assets.userId, profileId)).orderBy(desc(assets.updatedAt)).all()
  const netWorthData = getNetWorth(authUserId)
  const history = getNetWorthHistory(authUserId, 24)
  const previousPoint = history.length > 0 ? history[history.length - 1] : null
  const netWorthDelta = previousPoint ? netWorthData.netWorth - previousPoint.netWorth : null
  const items = rows.map(buildAssetOverviewItem)
  const investmentPnl = items.reduce((sum, item) => sum + (item.pnl ?? 0), 0)
  return {
    netWorth: netWorthData.netWorth,
    goldPricePerLuong: profile.goldPricePerLuong,
    previousNetWorth: previousPoint?.netWorth ?? null,
    netWorthDelta,
    netWorthDeltaPercent: netWorthDelta !== null && previousPoint?.netWorth ? Math.round((netWorthDelta / Math.abs(previousPoint.netWorth)) * 1000) / 10 : null,
    totalAssets: netWorthData.totalAssets,
    totalDebt: netWorthData.totalDebt,
    investmentPnl,
    allocation: netWorthData.byType,
    history,
    groups: buildAssetOverviewGroups(items),
  }
}

export function revalueAssets(authUserId: string): AssetOverview {
  const profile = getProfileSettings(authUserId)
  if (profile.goldPricePerLuong === null || profile.goldPricePerLuong <= 0) {
    throw Object.assign(new Error('Chưa cấu hình giá 1 lượng vàng'), { status: 400 })
  }
  revalueGoldAssetsForProfile(profile.id, profile.goldPricePerLuong)
  return getAssetOverview(authUserId)
}

/**
 * Update asset balance by adding or subtracting amount.
 * Used when transactions affect bank account balances.
 */
export function updateAssetBalance(
  authUserId: string,
  assetId: string,
  amount: number,
  isIncome: boolean
): Asset {
  const profileId = getProfileId(authUserId)
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!asset || asset.userId !== profileId) {
    throw Object.assign(new Error('Asset not found'), { status: 404 })
  }

  // Calculate new value: add for income, subtract for expense
  const newValue = isIncome
    ? asset.currentValue + amount
    : asset.currentValue - amount

  // Update asset value and add history record
  db.update(assets).set({ currentValue: newValue, updatedAt: sql`(datetime('now'))` }).where(eq(assets.id, assetId)).run()

  db.insert(assetHistory).values({
    id: crypto.randomUUID(),
    assetId,
    value: newValue,
    date: new Date().toLocaleDateString('sv'),
  }).run()

  return db.select().from(assets).where(eq(assets.id, assetId)).get()! as unknown as Asset
}
