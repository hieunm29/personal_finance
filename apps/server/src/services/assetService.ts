import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db'
import { assets, assetHistory, userProfiles } from '../db/schema'
import type { CreateAssetInput, UpdateAssetInput } from '@pf/shared'
import type { Asset, NetWorthData, NetWorthHistoryPoint, AssetAllocationItem } from '@pf/shared'

const TYPE_LABELS: Record<string, string> = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  gold: 'Vàng',
  stock: 'Cổ phiếu',
  savings: 'Tiết kiệm',
  real_estate: 'Bất động sản',
  debt: 'Nợ',
}

function getProfileId(authUserId: string): string {
  const p = db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.authUserId, authUserId)).get()
  if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return p.id
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
  const profileId = getProfileId(authUserId)
  const id = crypto.randomUUID()
  db.insert(assets).values({
    id,
    userId: profileId,
    type: data.type,
    name: data.name,
    currentValue: data.currentValue,
    metadata: data.metadata ?? null,
    note: data.note ?? null,
  }).run()
  return db.select().from(assets).where(eq(assets.id, id)).get()! as unknown as Asset
}

export function updateAsset(authUserId: string, assetId: string, data: UpdateAssetInput): Asset {
  const profileId = getProfileId(authUserId)
  const asset = db.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!asset || asset.userId !== profileId) {
    throw Object.assign(new Error('Asset not found'), { status: 404 })
  }

  const setFields: Record<string, unknown> = { updatedAt: sql`(datetime('now'))` }
  if (data.type !== undefined) setFields.type = data.type
  if (data.name !== undefined) setFields.name = data.name
  if (data.currentValue !== undefined) setFields.currentValue = data.currentValue
  if (data.metadata !== undefined) setFields.metadata = data.metadata
  if (data.note !== undefined) setFields.note = data.note

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

  db.update(assets).set({ currentValue: newValue, updatedAt: sql`(datetime('now'))` }).where(eq(assets.id, assetId)).run()

  db.insert(assetHistory).values({
    id: crypto.randomUUID(),
    assetId,
    value: newValue,
    date: new Date().toLocaleDateString('sv'),
  }).run()

  return db.select().from(assets).where(eq(assets.id, assetId)).get()! as unknown as Asset
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
    .orderBy(assetHistory.date, assetHistory.createdAt)
    .all()

  // Group by month, then track latest value per asset within each month
  const monthMap = new Map<string, Map<string, { value: number; type: string }>>()
  for (const row of rows) {
    const month = row.date.substring(0, 7)
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    monthMap.get(month)!.set(row.assetId, { value: row.value, type: row.type })
  }

  const result: NetWorthHistoryPoint[] = []
  for (const [month, assetMap] of Array.from(monthMap.entries()).sort()) {
    let netWorth = 0
    for (const { value, type } of assetMap.values()) {
      if (type === 'debt') netWorth -= value
      else netWorth += value
    }
    result.push({ month, netWorth })
  }

  return limit ? result.slice(-limit) : result
}
