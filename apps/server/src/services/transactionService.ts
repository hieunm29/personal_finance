import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { transactions, categories, wallets, userProfiles } from '../db/schema'
import type { CreateTransactionInput, UpdateTransactionInput, TransactionFilter } from '@pf/shared'

// Resolve authUserId → userProfile.id
function getProfileId(authUserId: string): string {
  const profile = db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()
  if (!profile) throw new Error('Profile not found')
  return profile.id
}

export function createTransaction(authUserId: string, data: CreateTransactionInput) {
  const profileId = getProfileId(authUserId)

  // Ownership checks
  const category = db.select().from(categories)
    .where(and(eq(categories.id, data.categoryId), eq(categories.userId, profileId)))
    .get()
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })
  if (category.type !== data.type) throw Object.assign(new Error('Category type mismatch'), { status: 400 })

  const wallet = db.select().from(wallets)
    .where(and(eq(wallets.id, data.walletId), eq(wallets.userId, profileId)))
    .get()
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 })

  const id = crypto.randomUUID()
  db.insert(transactions).values({
    id,
    userId: profileId,
    type: data.type,
    amount: data.amount,
    categoryId: data.categoryId,
    walletId: data.walletId,
    toWalletId: data.toWalletId ?? null,
    date: data.date,
    note: data.note ?? null,
    isRecurring: data.isRecurring ?? false,
  }).run()

  return getTransactionById(authUserId, id)
}

export function getTransactionById(authUserId: string, id: string) {
  const profileId = getProfileId(authUserId)

  const row = db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      type: transactions.type,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      walletId: transactions.walletId,
      toWalletId: transactions.toWalletId,
      date: transactions.date,
      note: transactions.note,
      isRecurring: transactions.isRecurring,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      category: {
        id: categories.id,
        userId: categories.userId,
        groupId: categories.groupId,
        name: categories.name,
        type: categories.type,
        icon: categories.icon,
        color: categories.color,
        isVisible: categories.isVisible,
        isDefault: categories.isDefault,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
      },
      wallet: {
        id: wallets.id,
        userId: wallets.userId,
        name: wallets.name,
        type: wallets.type,
        initialBalance: wallets.initialBalance,
        isDefault: wallets.isDefault,
        createdAt: wallets.createdAt,
        updatedAt: wallets.updatedAt,
      },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, profileId)))
    .get()

  if (!row) throw Object.assign(new Error('Transaction not found'), { status: 404 })
  return row
}

export function getTransactions(authUserId: string, filters: TransactionFilter) {
  const profileId = getProfileId(authUserId)

  const conditions = [eq(transactions.userId, profileId)]
  if (filters.type) conditions.push(eq(transactions.type, filters.type))
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId))
  if (filters.walletId) conditions.push(eq(transactions.walletId, filters.walletId))
  if (filters.dateFrom) conditions.push(gte(transactions.date, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.date, filters.dateTo))
  if (filters.amountFrom !== undefined) conditions.push(gte(transactions.amount, filters.amountFrom))
  if (filters.amountTo !== undefined) conditions.push(lte(transactions.amount, filters.amountTo))
  // Note: search filter is applied in JS (not SQL) for Unicode-aware case-insensitive matching

  const where = and(...conditions)
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20

  const selectShape = {
    id: transactions.id,
    userId: transactions.userId,
    type: transactions.type,
    amount: transactions.amount,
    categoryId: transactions.categoryId,
    walletId: transactions.walletId,
    toWalletId: transactions.toWalletId,
    date: transactions.date,
    note: transactions.note,
    isRecurring: transactions.isRecurring,
    createdAt: transactions.createdAt,
    updatedAt: transactions.updatedAt,
    category: {
      id: categories.id,
      userId: categories.userId,
      groupId: categories.groupId,
      name: categories.name,
      type: categories.type,
      icon: categories.icon,
      color: categories.color,
      isVisible: categories.isVisible,
      isDefault: categories.isDefault,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
    },
    wallet: {
      id: wallets.id,
      userId: wallets.userId,
      name: wallets.name,
      type: wallets.type,
      initialBalance: wallets.initialBalance,
      isDefault: wallets.isDefault,
      createdAt: wallets.createdAt,
      updatedAt: wallets.updatedAt,
    },
  }

  const baseQuery = db
    .select(selectShape)
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(where)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))

  let totalIncome = 0
  let totalExpense = 0
  let total: number
  let rows: ReturnType<typeof baseQuery.all>

  if (filters.search) {
    // Fetch all SQL-filtered rows, then filter by search in JS (Unicode-aware)
    const searchLower = filters.search.toLowerCase()
    const allRows = baseQuery.all()
    const filtered = allRows.filter((r) => r.note?.toLowerCase().includes(searchLower))
    total = filtered.length
    rows = filtered.slice((page - 1) * limit, page * limit)
    for (const r of filtered) {
      if (r.type === 'income') totalIncome += r.amount
      else if (r.type === 'expense') totalExpense += r.amount
    }
  } else {
    rows = baseQuery.limit(limit).offset((page - 1) * limit).all()
    const countRow = db.select({ count: sql<number>`count(*)` }).from(transactions).where(where).get()
    total = countRow?.count ?? 0
    const incomeRow = db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(and(...conditions, eq(transactions.type, 'income')))
      .get()
    const expenseRow = db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(and(...conditions, eq(transactions.type, 'expense')))
      .get()
    totalIncome = incomeRow?.total ?? 0
    totalExpense = expenseRow?.total ?? 0
  }

  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      totalIncome,
      totalExpense,
    },
  }
}

export function updateTransaction(authUserId: string, id: string, data: UpdateTransactionInput) {
  // Ownership check (throws 404 if not found)
  getTransactionById(authUserId, id)

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  }
  if (data.amount !== undefined) updates.amount = data.amount
  if (data.categoryId !== undefined) updates.categoryId = data.categoryId
  if (data.walletId !== undefined) updates.walletId = data.walletId
  if (data.toWalletId !== undefined) updates.toWalletId = data.toWalletId
  if (data.date !== undefined) updates.date = data.date
  if (data.note !== undefined) updates.note = data.note
  if (data.isRecurring !== undefined) updates.isRecurring = data.isRecurring

  db.update(transactions).set(updates).where(eq(transactions.id, id)).run()
  return getTransactionById(authUserId, id)
}

export function deleteTransaction(authUserId: string, id: string) {
  const profileId = getProfileId(authUserId)
  const existing = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, profileId)))
    .get()
  if (!existing) throw Object.assign(new Error('Transaction not found'), { status: 404 })
  db.delete(transactions).where(eq(transactions.id, id)).run()
}
