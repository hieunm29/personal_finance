import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { transactions, wallets, categories, userProfiles } from '../db/schema'
import type { DashboardData, TopExpenseCategory, MonthlyChartPoint, TransactionWithRelations } from '@pf/shared'
import { getBudgetProgress } from './budgetService'
import { getNetWorth } from './assetService'

function getProfileId(authUserId: string): string {
  const p = db.select({ id: userProfiles.id }).from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId)).get()
  if (!p) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return p.id
}

function getMonthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { start: `${month}-01`, end: new Date(y, m, 0).toLocaleDateString('sv') }
}

export function getDashboardData(authUserId: string, month: string): DashboardData {
  const profileId = getProfileId(authUserId)
  const { start: monthStart, end: monthEnd } = getMonthRange(month)

  // Prev month
  const [y, m] = month.split('-').map(Number)
  const prevMonth = new Date(y, m - 2, 1).toLocaleDateString('sv').substring(0, 7)
  const { start: prevStart, end: prevEnd } = getMonthRange(prevMonth)

  // Current month income/expense
  const totalIncome = db.select({ v: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'income'),
      gte(transactions.date, monthStart), lte(transactions.date, monthEnd))).get()!.v

  const totalExpense = db.select({ v: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'expense'),
      gte(transactions.date, monthStart), lte(transactions.date, monthEnd))).get()!.v

  // Prev month income/expense
  const prevMonthIncome = db.select({ v: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'income'),
      gte(transactions.date, prevStart), lte(transactions.date, prevEnd))).get()!.v

  const prevMonthExpense = db.select({ v: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'expense'),
      gte(transactions.date, prevStart), lte(transactions.date, prevEnd))).get()!.v

  // Total balance (all-time)
  const walletInit = db.select({ v: sql<number>`COALESCE(SUM(initial_balance), 0)` })
    .from(wallets).where(eq(wallets.userId, profileId)).get()!.v

  const allIncome = db.select({ v: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'income'))).get()!.v

  const allExpense = db.select({ v: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'expense'))).get()!.v

  const totalBalance = walletInit + allIncome - allExpense

  // Recent 5 transactions
  const recentRows = db.select({
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
  .where(eq(transactions.userId, profileId))
  .orderBy(desc(transactions.date), desc(transactions.createdAt))
  .limit(5).all()

  // Top 5 expense categories this month
  const catRows = db.select({
    categoryId: transactions.categoryId,
    categoryName: categories.name,
    categoryIcon: categories.icon,
    categoryColor: categories.color,
    total: sql<number>`SUM(${transactions.amount})`,
  })
  .from(transactions)
  .leftJoin(categories, eq(transactions.categoryId, categories.id))
  .where(and(
    eq(transactions.userId, profileId),
    eq(transactions.type, 'expense'),
    gte(transactions.date, monthStart),
    lte(transactions.date, monthEnd)
  ))
  .groupBy(transactions.categoryId)
  .orderBy(desc(sql`SUM(${transactions.amount})`))
  .limit(5).all()

  const topExpenseCategories: TopExpenseCategory[] = catRows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? 'Không phân loại',
    categoryIcon: r.categoryIcon ?? null,
    categoryColor: r.categoryColor ?? null,
    amount: r.total,
    percentage: totalExpense > 0 ? Math.round((r.total / totalExpense) * 100) : 0,
  }))

  // Monthly chart: last 6 months
  const sixMonthsAgo = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5)
    d.setDate(1)
    return d.toLocaleDateString('sv')
  })()

  const chartRows = db.select({
    type: transactions.type,
    amount: transactions.amount,
    date: transactions.date,
  })
  .from(transactions)
  .where(and(eq(transactions.userId, profileId), gte(transactions.date, sixMonthsAgo)))
  .all()

  const monthMap = new Map<string, { income: number; expense: number }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    d.setDate(1)
    monthMap.set(d.toLocaleDateString('sv').substring(0, 7), { income: 0, expense: 0 })
  }

  for (const row of chartRows) {
    const key = row.date.substring(0, 7)
    const entry = monthMap.get(key)
    if (!entry) continue
    if (row.type === 'income') entry.income += row.amount
    else if (row.type === 'expense') entry.expense += row.amount
  }

  const monthlyChart: MonthlyChartPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  return {
    totalIncome,
    totalExpense,
    netAmount: totalIncome - totalExpense,
    prevMonthIncome,
    prevMonthExpense,
    totalBalance,
    netWorth: (() => { try { return getNetWorth(authUserId).netWorth } catch { return null } })(),
    recentTransactions: recentRows as unknown as TransactionWithRelations[],
    topExpenseCategories,
    monthlyChart,
    budgetProgress: (() => {
      const bp = getBudgetProgress(authUserId, month)
      if (!bp) return null
      return bp.categories.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.category.name,
        limit: c.limitAmount,
        spent: c.spent,
      }))
    })(),
  }
}
