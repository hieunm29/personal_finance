import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { assetHistory, assets, categories, recurringTemplates, transactions, userProfiles, wallets } from '../db/schema'
import type {
  CreateTransactionInput,
  TransactionAnalytics,
  TransactionAnalyticsFilter,
  TransactionFilter,
  UpdateTransactionInput,
} from '@pf/shared'

type TransactionQueryFilter = Omit<TransactionAnalyticsFilter, 'page' | 'limit'>

function getProfileId(authUserId: string): string {
  const profile = db.select({ id: userProfiles.id }).from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId)).get()
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return profile.id
}

const transactionSelect = {
  id: transactions.id, userId: transactions.userId, type: transactions.type, amount: transactions.amount,
  categoryId: transactions.categoryId, walletId: transactions.walletId, assetId: transactions.assetId,
  recurringTemplateId: transactions.recurringTemplateId,
  toWalletId: transactions.toWalletId, date: transactions.date, note: transactions.note,
  isRecurring: transactions.isRecurring, createdAt: transactions.createdAt, updatedAt: transactions.updatedAt,
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
  asset: { id: assets.id, name: assets.name, type: assets.type, currentValue: assets.currentValue },
  recurrenceInterval: recurringTemplates.interval,
}

function walletReferences(filters: TransactionQueryFilter): { walletIds: string[]; assetIds: string[] } {
  const refs = [filters.walletId, ...(filters.walletIds?.split(',') ?? [])]
    .filter((value): value is string => !!value).map((value) => value.trim())
  return {
    walletIds: [...new Set(refs.filter((value) => !value.startsWith('asset-')))],
    assetIds: [...new Set(refs.filter((value) => value.startsWith('asset-')).map((value) => value.slice(6)))],
  }
}

function buildConditions(profileId: string, filters: TransactionQueryFilter) {
  const conditions = [eq(transactions.userId, profileId)]
  if (filters.type) conditions.push(eq(transactions.type, filters.type))
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId))
  if (filters.dateFrom) conditions.push(gte(transactions.date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.date, filters.dateTo))
  if (filters.amountFrom !== undefined) conditions.push(gte(transactions.amount, filters.amountFrom))
  if (filters.amountTo !== undefined) conditions.push(lte(transactions.amount, filters.amountTo))
  const refs = walletReferences(filters)
  const walletConditions = []
  if (refs.walletIds.length > 0) walletConditions.push(inArray(transactions.walletId, refs.walletIds))
  if (refs.assetIds.length > 0) walletConditions.push(inArray(transactions.assetId, refs.assetIds))
  if (walletConditions.length > 0) conditions.push(walletConditions.length === 1 ? walletConditions[0] : or(...walletConditions)!)
  return conditions
}

function buildTransactionQuery(profileId: string, filters: TransactionQueryFilter) {
  return db.select(transactionSelect).from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .leftJoin(assets, eq(transactions.assetId, assets.id))
    .leftJoin(recurringTemplates, eq(transactions.recurringTemplateId, recurringTemplates.id))
    .where(and(...buildConditions(profileId, filters)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
}

type SearchableTransaction = {
  amount: number
  note: string | null
  category: { name: string | null } | null
  wallet: { name: string | null } | null
  asset: { name: string | null } | null
}

function matchesSearch(row: SearchableTransaction, search?: string): boolean {
  const needle = search?.trim().toLocaleLowerCase()
  if (!needle) return true
  const amountValues = [String(row.amount), String(Math.round(row.amount / 100)), Math.round(row.amount / 100).toLocaleString('vi-VN')]
  return [row.note, row.category?.name, row.wallet?.name, row.asset?.name, ...amountValues]
    .some((value) => value?.toLocaleLowerCase().includes(needle))
}

function getFilteredRows(authUserId: string, filters: TransactionQueryFilter) {
  const profileId = getProfileId(authUserId)
  const rows = buildTransactionQuery(profileId, filters).all()
  return filters.search ? rows.filter((row) => matchesSearch(row, filters.search)) : rows
}

function resolveAccount(profileId: string, reference: string) {
  if (reference.startsWith('asset-')) {
    const assetId = reference.slice(6)
    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get()
    if (!asset || asset.userId !== profileId) throw Object.assign(new Error('Asset not found'), { status: 404 })
    if (asset.type !== 'bank') throw Object.assign(new Error('Wallet must be a bank asset'), { status: 400 })
    return { walletId: null, assetId }
  }
  const wallet = db.select({ id: wallets.id }).from(wallets)
    .where(and(eq(wallets.id, reference), eq(wallets.userId, profileId))).get()
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 })
  return { walletId: wallet.id, assetId: null }
}

function assertCategory(profileId: string, categoryId: string, type: CreateTransactionInput['type']) {
  const category = db.select().from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, profileId))).get()
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })
  if (type === 'transfer' || category.type !== type) {
    throw Object.assign(new Error('Category type mismatch'), { status: 400 })
  }
  return category
}

function assertTargetWallet(profileId: string, targetId: string | undefined) {
  if (!targetId) return null
  if (targetId.startsWith('asset-')) throw Object.assign(new Error('Transfer target must be a wallet'), { status: 400 })
  const target = db.select({ id: wallets.id }).from(wallets)
    .where(and(eq(wallets.id, targetId), eq(wallets.userId, profileId))).get()
  if (!target) throw Object.assign(new Error('Target wallet not found'), { status: 404 })
  return target.id
}

function assetDelta(type: string, amount: number): number {
  return type === 'income' ? amount : -amount
}

function updateAssetValueInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0], profileId: string, assetId: string, delta: number,
) {
  const asset = tx.select({ id: assets.id, userId: assets.userId, currentValue: assets.currentValue })
    .from(assets).where(eq(assets.id, assetId)).get()
  if (!asset || asset.userId !== profileId) throw Object.assign(new Error('Asset not found'), { status: 404 })
  const nextValue = asset.currentValue + delta
  tx.update(assets).set({ currentValue: nextValue, updatedAt: sql`(datetime('now'))` })
    .where(eq(assets.id, assetId)).run()
  tx.insert(assetHistory).values({ id: crypto.randomUUID(), assetId, value: nextValue, date: new Date().toLocaleDateString('sv') }).run()
}

export function createTransaction(authUserId: string, data: CreateTransactionInput) {
  const profileId = getProfileId(authUserId)
  if (data.isRecurring && !data.recurrenceInterval) {
    throw Object.assign(new Error('Vui lòng chọn chu kỳ lặp lại'), { status: 400 })
  }
  assertCategory(profileId, data.categoryId, data.type)
  const account = resolveAccount(profileId, data.walletId)
  const targetWalletId = assertTargetWallet(profileId, data.toWalletId)
  if (data.type !== 'transfer' && targetWalletId) throw Object.assign(new Error('Target wallet is only valid for transfers'), { status: 400 })
  const id = crypto.randomUUID()
  db.transaction((tx) => {
    const recurringTemplateId = data.isRecurring && data.recurrenceInterval ? crypto.randomUUID() : null
    tx.insert(transactions).values({
      id, userId: profileId, type: data.type, amount: data.amount, categoryId: data.categoryId,
      walletId: account.walletId, assetId: account.assetId, recurringTemplateId, toWalletId: targetWalletId,
      date: data.date, note: data.note ?? null, isRecurring: data.isRecurring ?? false,
    }).run()
    if (recurringTemplateId) {
      tx.insert(recurringTemplates).values({
        id: recurringTemplateId, userId: profileId, type: data.type, amount: data.amount,
        categoryId: data.categoryId, walletId: account.walletId, assetId: account.assetId,
        note: data.note ?? null, interval: data.recurrenceInterval!, startDate: data.date,
        endDate: null, lastGeneratedDate: data.date, isActive: true,
      }).run()
    }
    if (account.assetId && data.type !== 'transfer') updateAssetValueInTransaction(tx, profileId, account.assetId, assetDelta(data.type, data.amount))
  })
  return getTransactionById(authUserId, id)
}

export function getTransactionById(authUserId: string, id: string) {
  const profileId = getProfileId(authUserId)
  const row = db.select(transactionSelect).from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .leftJoin(assets, eq(transactions.assetId, assets.id))
    .leftJoin(recurringTemplates, eq(transactions.recurringTemplateId, recurringTemplates.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, profileId))).get()
  if (!row) throw Object.assign(new Error('Transaction not found'), { status: 404 })
  return row
}

export function getTransactions(authUserId: string, filters: TransactionFilter) {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const rows = getFilteredRows(authUserId, filters)
  const totalIncome = rows.reduce((sum, row) => sum + (row.type === 'income' ? row.amount : 0), 0)
  const totalExpense = rows.reduce((sum, row) => sum + (row.type === 'expense' ? row.amount : 0), 0)
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit), totalIncome, totalExpense },
  }
}

function previousDateRange(filters: TransactionAnalyticsFilter): { dateFrom: string; dateTo: string } | null {
  if (!filters.dateFrom || !filters.dateTo) return null
  const start = new Date(`${filters.dateFrom}T00:00:00`)
  const end = new Date(`${filters.dateTo}T00:00:00`)
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (span <= 0) return null
  const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  if (start.getDate() === 1 && end.getDate() === lastDayOfMonth) {
    const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
    const previousEnd = new Date(start.getFullYear(), start.getMonth(), 0)
    return { dateFrom: previousStart.toLocaleDateString('sv'), dateTo: previousEnd.toLocaleDateString('sv') }
  }
  const previousEnd = new Date(start)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - span + 1)
  return { dateFrom: previousStart.toLocaleDateString('sv'), dateTo: previousEnd.toLocaleDateString('sv') }
}

export function getTransactionAnalytics(authUserId: string, filters: TransactionAnalyticsFilter): TransactionAnalytics {
  const rows = getFilteredRows(authUserId, filters)
  const totalIncome = rows.reduce((sum, row) => sum + (row.type === 'income' ? row.amount : 0), 0)
  const totalExpense = rows.reduce((sum, row) => sum + (row.type === 'expense' ? row.amount : 0), 0)
  const dailyMap = new Map<string, number>()
  const dailyTotals = new Map<string, { income: number; expense: number }>()
  const categoryMap = new Map<string, { categoryId: string | null; categoryName: string; categoryColor: string | null; categoryIcon: string | null; amount: number }>()
  for (const row of rows) {
    const day = dailyTotals.get(row.date) ?? { income: 0, expense: 0 }
    if (row.type === 'income') day.income += row.amount
    if (row.type === 'expense') day.expense += row.amount
    dailyTotals.set(row.date, day)
    if (row.type !== 'expense') continue
    dailyMap.set(row.date, (dailyMap.get(row.date) ?? 0) + row.amount)
    const key = row.categoryId ?? 'null'
    const current = categoryMap.get(key) ?? { categoryId: row.categoryId, categoryName: row.category?.name ?? 'Không phân loại', categoryColor: row.category?.color ?? null, categoryIcon: row.category?.icon ?? null, amount: 0 }
    current.amount += row.amount
    categoryMap.set(key, current)
  }
  const previous = previousDateRange(filters)
  let prevNetAmount: number | null = null
  if (previous) {
    const previousRows = getFilteredRows(authUserId, { ...filters, ...previous })
    prevNetAmount = previousRows.reduce((sum, row) => sum + (row.type === 'income' ? row.amount : row.type === 'expense' ? -row.amount : 0), 0)
  }
  return {
    totalIncome, totalExpense,
    incomeCount: rows.filter((row) => row.type === 'income').length,
    expenseCount: rows.filter((row) => row.type === 'expense').length,
    netAmount: totalIncome - totalExpense, prevNetAmount, total: rows.length,
    dailyExpenses: [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount })),
    dailyTotals: [...dailyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, totals]) => ({ date, ...totals, netAmount: totals.income - totals.expense })),
    categories: [...categoryMap.values()].sort((a, b) => b.amount - a.amount).map((category) => ({ ...category, percentage: totalExpense > 0 ? Math.round(category.amount / totalExpense * 1000) / 10 : 0 })),
  }
}

function csvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? '')
  const safe = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

export function exportTransactions(authUserId: string, filters: TransactionAnalyticsFilter): string {
  const rows = getFilteredRows(authUserId, filters)
  const lines = [
    ['date', 'type', 'category', 'amount', 'wallet', 'note'].map(csvCell).join(','),
    ...rows.map((row) => [row.date, row.type, row.category?.name ?? 'Không phân loại', row.amount / 100, row.wallet?.name ?? row.asset?.name ?? '', row.note].map(csvCell).join(',')),
  ]
  return lines.join('\r\n') + '\r\n'
}

export function updateTransaction(authUserId: string, id: string, data: UpdateTransactionInput) {
  const profileId = getProfileId(authUserId)
  const existing = db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, profileId))).get()
  if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 })
  if (data.categoryId !== undefined) assertCategory(profileId, data.categoryId, existing.type as CreateTransactionInput['type'])
  const nextAccount = data.walletId !== undefined ? resolveAccount(profileId, data.walletId) : { walletId: existing.walletId, assetId: existing.assetId }
  const nextTarget = data.toWalletId !== undefined ? assertTargetWallet(profileId, data.toWalletId) : existing.toWalletId
  if (existing.type !== 'transfer' && nextTarget) throw Object.assign(new Error('Target wallet is only valid for transfers'), { status: 400 })
  const nextAmount = data.amount ?? existing.amount
  const existingTemplate = existing.recurringTemplateId
    ? db.select().from(recurringTemplates).where(eq(recurringTemplates.id, existing.recurringTemplateId)).get()
    : null
  const nextRecurring = data.isRecurring ?? existing.isRecurring
  const nextInterval = data.recurrenceInterval ?? existingTemplate?.interval ?? null
  if (nextRecurring && !nextInterval) throw Object.assign(new Error('Vui lòng chọn chu kỳ lặp lại'), { status: 400 })
  const nextTemplateId = nextRecurring ? (existing.recurringTemplateId ?? crypto.randomUUID()) : null
  const nextCategoryId = data.categoryId ?? existing.categoryId
  db.transaction((tx) => {
    if (existing.assetId && existing.type !== 'transfer') updateAssetValueInTransaction(tx, profileId, existing.assetId, -assetDelta(existing.type, existing.amount))
    tx.update(transactions).set({ amount: nextAmount, categoryId: nextCategoryId, walletId: nextAccount.walletId, assetId: nextAccount.assetId, recurringTemplateId: nextTemplateId, toWalletId: nextTarget, date: data.date ?? existing.date, note: data.note !== undefined ? data.note : existing.note, isRecurring: nextRecurring, updatedAt: sql`(datetime('now'))` }).where(eq(transactions.id, id)).run()
    if (nextAccount.assetId && existing.type !== 'transfer') updateAssetValueInTransaction(tx, profileId, nextAccount.assetId, assetDelta(existing.type, nextAmount))
    if (nextTemplateId) {
      if (existingTemplate) {
        tx.update(recurringTemplates).set({
          amount: nextAmount, categoryId: nextCategoryId, walletId: nextAccount.walletId, assetId: nextAccount.assetId,
          note: data.note !== undefined ? data.note : existingTemplate.note, interval: nextInterval!,
          isActive: true,
        }).where(eq(recurringTemplates.id, nextTemplateId)).run()
      } else {
        tx.insert(recurringTemplates).values({
          id: nextTemplateId, userId: profileId, type: existing.type, amount: nextAmount, categoryId: nextCategoryId,
          walletId: nextAccount.walletId, assetId: nextAccount.assetId, note: data.note !== undefined ? data.note : existing.note,
          interval: nextInterval!, startDate: data.date ?? existing.date, endDate: null,
          lastGeneratedDate: data.date ?? existing.date, isActive: true,
        }).run()
      }
    } else if (existingTemplate) {
      tx.update(recurringTemplates).set({ isActive: false }).where(eq(recurringTemplates.id, existingTemplate.id)).run()
    }
  })
  return getTransactionById(authUserId, id)
}

export function deleteTransaction(authUserId: string, id: string) {
  const profileId = getProfileId(authUserId)
  const existing = db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, profileId))).get()
  if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 })
  db.transaction((tx) => {
    if (existing.assetId && existing.type !== 'transfer') updateAssetValueInTransaction(tx, profileId, existing.assetId, -assetDelta(existing.type, existing.amount))
    if (existing.recurringTemplateId) {
      tx.update(recurringTemplates).set({ isActive: false }).where(eq(recurringTemplates.id, existing.recurringTemplateId)).run()
    }
    tx.delete(transactions).where(eq(transactions.id, id)).run()
  })
}
