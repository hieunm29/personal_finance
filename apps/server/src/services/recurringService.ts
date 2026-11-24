import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { assetHistory, assets, categories, recurringTemplates, transactions, userProfiles, wallets } from '../db/schema'
import type { CreateRecurringInput, RecurringWithRelations, UpdateRecurringInput } from '@pf/shared'

function profileIdFor(authUserId: string): string {
  const profile = db.select({ id: userProfiles.id }).from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId)).get()
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return profile.id
}

function normalizedInterval(data: { interval?: 'weekly' | 'monthly' | 'yearly'; recurrenceInterval?: 'weekly' | 'monthly' | 'yearly' }) {
  return data.interval ?? data.recurrenceInterval
}

function validateDateOrder(startDate: string, endDate?: string | null) {
  if (endDate && endDate < startDate) throw Object.assign(new Error('Ngày kết thúc phải sau ngày bắt đầu'), { status: 400 })
}

function validateCategoryAndAccount(profileId: string, data: { type: string; categoryId: string; walletId: string }) {
  if (data.type === 'transfer') throw Object.assign(new Error('Giao dịch định kỳ chưa hỗ trợ chuyển khoản nội bộ'), { status: 400 })
  const category = db.select({ id: categories.id, type: categories.type }).from(categories)
    .where(and(eq(categories.id, data.categoryId), eq(categories.userId, profileId))).get()
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })
  if (category.type !== data.type) throw Object.assign(new Error('Category type mismatch'), { status: 400 })

  if (data.walletId.startsWith('asset-')) {
    const assetId = data.walletId.slice(6)
    const asset = db.select({ id: assets.id, userId: assets.userId, type: assets.type }).from(assets)
      .where(eq(assets.id, assetId)).get()
    if (!asset || asset.userId !== profileId) throw Object.assign(new Error('Asset not found'), { status: 404 })
    if (asset.type !== 'bank' && asset.type !== 'cash') throw Object.assign(new Error('Tài khoản phải là tiền mặt hoặc ngân hàng'), { status: 400 })
    return { walletId: null, assetId }
  }

  const wallet = db.select({ id: wallets.id }).from(wallets)
    .where(and(eq(wallets.id, data.walletId), eq(wallets.userId, profileId))).get()
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 })
  return { walletId: wallet.id, assetId: null }
}

const recurringSelect = {
  id: recurringTemplates.id,
  userId: recurringTemplates.userId,
  type: recurringTemplates.type,
  amount: recurringTemplates.amount,
  categoryId: recurringTemplates.categoryId,
  walletId: recurringTemplates.walletId,
  assetId: recurringTemplates.assetId,
  note: recurringTemplates.note,
  interval: recurringTemplates.interval,
  startDate: recurringTemplates.startDate,
  endDate: recurringTemplates.endDate,
  lastGeneratedDate: recurringTemplates.lastGeneratedDate,
  isActive: recurringTemplates.isActive,
  createdAt: recurringTemplates.createdAt,
  category: {
    id: categories.id, userId: categories.userId, groupId: categories.groupId, name: categories.name,
    type: categories.type, icon: categories.icon, color: categories.color, isVisible: categories.isVisible,
    isDefault: categories.isDefault, sortOrder: categories.sortOrder, createdAt: categories.createdAt,
  },
  wallet: {
    id: wallets.id, userId: wallets.userId, name: wallets.name, type: wallets.type,
    initialBalance: wallets.initialBalance, isDefault: wallets.isDefault, createdAt: wallets.createdAt,
    updatedAt: wallets.updatedAt,
  },
}

export function createRecurring(authUserId: string, data: CreateRecurringInput) {
  const profileId = profileIdFor(authUserId)
  const interval = normalizedInterval(data)
  if (!interval) throw Object.assign(new Error('Vui lòng chọn chu kỳ lặp lại'), { status: 400 })
  validateDateOrder(data.startDate, data.endDate)
  const account = validateCategoryAndAccount(profileId, data)
  const id = crypto.randomUUID()
  db.insert(recurringTemplates).values({
    id, userId: profileId, type: data.type, amount: data.amount, categoryId: data.categoryId,
    walletId: account.walletId, assetId: account.assetId, note: data.note ?? null, interval,
    startDate: data.startDate, endDate: data.endDate ?? null, lastGeneratedDate: null, isActive: true,
  }).run()
  return getRecurringById(authUserId, id)
}

export function getRecurringList(authUserId: string): RecurringWithRelations[] {
  const profileId = profileIdFor(authUserId)
  return db.select(recurringSelect).from(recurringTemplates)
    .leftJoin(categories, eq(recurringTemplates.categoryId, categories.id))
    .leftJoin(wallets, eq(recurringTemplates.walletId, wallets.id))
    .where(eq(recurringTemplates.userId, profileId))
    .orderBy(desc(recurringTemplates.createdAt)).all() as unknown as RecurringWithRelations[]
}

export function getRecurringById(authUserId: string, id: string): RecurringWithRelations {
  const profileId = profileIdFor(authUserId)
  const row = db.select(recurringSelect).from(recurringTemplates)
    .leftJoin(categories, eq(recurringTemplates.categoryId, categories.id))
    .leftJoin(wallets, eq(recurringTemplates.walletId, wallets.id))
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, profileId))).get()
  if (!row) throw Object.assign(new Error('Recurring template not found'), { status: 404 })
  return row as unknown as RecurringWithRelations
}

export function updateRecurring(authUserId: string, id: string, data: UpdateRecurringInput) {
  const profileId = profileIdFor(authUserId)
  const existing = db.select().from(recurringTemplates)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, profileId))).get()
  if (!existing) throw Object.assign(new Error('Recurring template not found'), { status: 404 })
  const interval = normalizedInterval(data)
  const endDate = data.endDate !== undefined ? data.endDate : existing.endDate
  validateDateOrder(existing.startDate, endDate)
  const updates: Record<string, unknown> = {}
  if (data.amount !== undefined) updates.amount = data.amount
  if (data.note !== undefined) updates.note = data.note
  if (data.endDate !== undefined) updates.endDate = data.endDate
  if (interval !== undefined) updates.interval = interval
  if (data.isActive !== undefined) updates.isActive = data.isActive
  db.update(recurringTemplates).set(updates).where(eq(recurringTemplates.id, id)).run()
  return getRecurringById(authUserId, id)
}

export function deleteRecurring(authUserId: string, id: string): void {
  const profileId = profileIdFor(authUserId)
  const existing = db.select({ id: recurringTemplates.id }).from(recurringTemplates)
    .where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, profileId))).get()
  if (!existing) throw Object.assign(new Error('Recurring template not found'), { status: 404 })
  db.delete(recurringTemplates).where(eq(recurringTemplates.id, id)).run()
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('sv')
}

/** Return the occurrence at a zero-based index anchored to startDate. Using
 * the original day-of-month avoids Jan-31 drifting to the 28th forever. */
function occurrenceAt(startDate: string, interval: string, index: number): string {
  const start = new Date(`${startDate}T00:00:00`)
  const day = start.getDate()
  if (interval === 'weekly') {
    start.setDate(day + index * 7)
    return formatDate(start)
  }
  if (interval === 'yearly') {
    start.setDate(1)
    start.setFullYear(start.getFullYear() + index)
    start.setMonth(start.getMonth(), Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
    return formatDate(start)
  }
  start.setDate(1)
  start.setMonth(start.getMonth() + index)
  start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()))
  return formatDate(start)
}

export interface UpcomingOccurrence {
  templateId: string
  date: string
  type: string
  amount: number
  categoryId: string
  note: string | null
}

/**
 * Các lần đến hạn của template đang bật trong [fromDate, toDate] mà CHƯA được sinh thành giao dịch
 * (lần ≤ lastGeneratedDate đã nằm trong sổ giao dịch nên bị bỏ qua, tránh đếm hai lần).
 * Tôn trọng endDate. Kết quả sắp theo ngày.
 */
export function listUpcomingOccurrences(authUserId: string, fromDate: string, toDate: string): UpcomingOccurrence[] {
  const profileId = profileIdFor(authUserId)
  const templates = db.select().from(recurringTemplates)
    .where(and(eq(recurringTemplates.userId, profileId), eq(recurringTemplates.isActive, true))).all()
  const result: UpcomingOccurrence[] = []
  for (const template of templates) {
    let index = 0
    let occurrence = occurrenceAt(template.startDate, template.interval, index)
    while (occurrence <= toDate && (!template.endDate || occurrence <= template.endDate) && index < 10_000) {
      if (occurrence >= fromDate && (!template.lastGeneratedDate || occurrence > template.lastGeneratedDate)) {
        result.push({
          templateId: template.id, date: occurrence, type: template.type, amount: template.amount,
          categoryId: template.categoryId, note: template.note,
        })
      }
      index += 1
      occurrence = occurrenceAt(template.startDate, template.interval, index)
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

export function generateDueTransactions(authUserId: string, today = new Date().toLocaleDateString('sv')) {
  const profileId = profileIdFor(authUserId)
  const createdIds: string[] = []

  db.transaction((tx) => {
    // Read due templates inside the write transaction. This is important for
    // idempotency: two concurrent callers must not both observe a stale
    // lastGeneratedDate and create the same occurrence.
    const templates = tx.select().from(recurringTemplates)
      .where(and(eq(recurringTemplates.userId, profileId), eq(recurringTemplates.isActive, true))).all()
    for (const template of templates) {
      if (template.startDate > today) continue
      let index = 0
      let occurrence = occurrenceAt(template.startDate, template.interval, index)
      while (template.lastGeneratedDate && occurrence <= template.lastGeneratedDate && index < 10_000) {
        index += 1
        occurrence = occurrenceAt(template.startDate, template.interval, index)
      }
      let lastGeneratedDate = template.lastGeneratedDate
      while (occurrence <= today && (!template.endDate || occurrence <= template.endDate) && index < 10_000) {
        const id = crypto.randomUUID()
        tx.insert(transactions).values({
          id, userId: profileId, type: template.type, amount: template.amount, categoryId: template.categoryId,
          walletId: template.walletId, assetId: template.assetId, recurringTemplateId: template.id, toWalletId: null, date: occurrence,
          note: template.note, isRecurring: true,
        }).run()
        if (template.assetId) {
          const asset = tx.select({ currentValue: assets.currentValue, userId: assets.userId }).from(assets)
            .where(eq(assets.id, template.assetId)).get()
          if (!asset || asset.userId !== profileId) throw Object.assign(new Error('Asset not found'), { status: 404 })
          const nextValue = asset.currentValue + (template.type === 'income' ? template.amount : -template.amount)
          tx.update(assets).set({ currentValue: nextValue }).where(eq(assets.id, template.assetId)).run()
          tx.insert(assetHistory).values({ id: crypto.randomUUID(), assetId: template.assetId, value: nextValue, date: occurrence }).run()
        }
        lastGeneratedDate = occurrence
        createdIds.push(id)
        index += 1
        occurrence = occurrenceAt(template.startDate, template.interval, index)
      }
      if (lastGeneratedDate !== template.lastGeneratedDate) {
        tx.update(recurringTemplates).set({ lastGeneratedDate }).where(eq(recurringTemplates.id, template.id)).run()
      }
      if (template.endDate && occurrence > template.endDate) {
        tx.update(recurringTemplates).set({ isActive: false }).where(eq(recurringTemplates.id, template.id)).run()
      }
    }
  })

  return { created: createdIds.length, transactionIds: createdIds }
}

/** Generate due occurrences for every local profile. Used by the server's
 * guarded hourly job; callers can still use the authenticated endpoint for an
 * immediate, user-scoped generation. */
export function generateDueTransactionsForAllUsers(today = new Date().toLocaleDateString('sv')) {
  const users = db.select({ authUserId: userProfiles.authUserId }).from(userProfiles).all()
  return users.map(({ authUserId }) => ({ authUserId, ...generateDueTransactions(authUserId, today) }))
}
