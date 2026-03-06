import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { transactions, categories, userProfiles, budgets, categoryBudgets } from '../db/schema'
import type { MonthlyOverview, MonthComparison, CategoryExpense, TrendDataPoint, BudgetComparisonItem, AnnualSummary, DateFilterPreset, DateRange } from '@pf/shared'
import { getNetWorth, getNetWorthHistory } from './assetService'

// Resolve authUserId → userProfile.id
function getProfileId(authUserId: string): string {
  const profile = db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.authUserId, authUserId)).get()
  if (!profile) throw new Error('Profile not found')
  return profile.id
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper functions
// ═════════════════════════════════════════════════════════════════════════════

export function parseDateRange(filter: DateFilterPreset | DateRange): DateRange {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // Get start of week (Monday)
  const getStartOfWeek = (d: Date) => {
    const result = new Date(d)
    const dayNum = result.getDay()
    const diff = result.getDate() - dayNum + (dayNum === 0 ? -6 : 1)
    return new Date(result.setDate(diff))
  }

  // Get days in month
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

  // Format to YYYY-MM-DD
  const fmt = (d: Date) => d.toLocaleDateString('sv')

  switch (filter) {
    case 'this_week':
      return { startDate: fmt(getStartOfWeek(today)), endDate: fmt(today) }
    case 'this_month':
      return { startDate: fmt(new Date(year, month, 1)), endDate: fmt(today) }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3
      return { startDate: fmt(new Date(year, quarterStart, 1)), endDate: fmt(today) }
    }
    case 'this_year':
      return { startDate: fmt(new Date(year, 0, 1)), endDate: fmt(today) }
    case 'last_month': {
      const lastMonth = month === 0 ? 11 : month - 1
      const lastMonthYear = month === 0 ? year - 1 : year
      const daysInLastMonth = getDaysInMonth(lastMonthYear, lastMonth)
      return {
        startDate: fmt(new Date(lastMonthYear, lastMonth, 1)),
        endDate: fmt(new Date(lastMonthYear, lastMonth, daysInLastMonth)),
      }
    }
    case 'last_year':
      return { startDate: fmt(new Date(year - 1, 0, 1)), endDate: fmt(new Date(year - 1, 11, 31)) }
    default: // DateRange object
      return filter as DateRange
  }
}

export function getMonthRange(year: number, month: number): DateRange {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  return { startDate, endDate }
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-01: Monthly Overview
// ═════════════════════════════════════════════════════════════════════════════

export function getMonthlyOverview(authUserId: string, year: number, month: number): MonthlyOverview {
  const profileId = getProfileId(authUserId)
  const { startDate, endDate } = getMonthRange(year, month)

  const where = and(
    eq(transactions.userId, profileId),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate)
  )

  const incomeResult = db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)`, count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(and(where, eq(transactions.type, 'income')))
    .get()

  const expenseResult = db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)`, count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(and(where, eq(transactions.type, 'expense')))
    .get()

  const totalCount = (incomeResult?.count ?? 0) + (expenseResult?.count ?? 0)

  const totalIncome = incomeResult?.total ?? 0
  const totalExpense = expenseResult?.total ?? 0

  return {
    totalIncome,
    totalExpense,
    transactionCount: totalCount,
    incomeCount: incomeResult?.count ?? 0,
    expenseCount: expenseResult?.count ?? 0,
    difference: totalIncome - totalExpense,
  }
}

export function getPreviousMonthComparison(authUserId: string, year: number, month: number): MonthComparison {
  // Calculate previous month
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear -= 1
  }

  const current = getMonthlyOverview(authUserId, year, month)
  const previous = getMonthlyOverview(authUserId, prevYear, prevMonth)

  const calcPercent = (curr: number, prev: number) => {
    if (prev === 0) return null
    return Math.round(((curr - prev) / prev) * 100 * 10) / 10
  }

  return {
    incomeChangePercent: calcPercent(current.totalIncome, previous.totalIncome),
    expenseChangePercent: calcPercent(current.totalExpense, previous.totalExpense),
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-02: Expenses by Category
// ═════════════════════════════════════════════════════════════════════════════

export function getExpensesByCategory(authUserId: string, startDate: string, endDate: string): CategoryExpense[] {
  const profileId = getProfileId(authUserId)

  const rows = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      totalAmount: sql<number>`COALESCE(SUM(transactions.amount), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, profileId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.categoryId, categories.id, categories.name, categories.icon, categories.color)
    .orderBy(desc(sql<number>`COALESCE(SUM(transactions.amount), 0)`))
    .all()

  // Calculate total for percentage
  const totalExpense = rows.reduce((sum, r) => sum + r.totalAmount, 0)

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? 'Không danh mục',
    categoryIcon: r.categoryIcon,
    categoryColor: r.categoryColor,
    totalAmount: r.totalAmount,
    percentage: totalExpense > 0 ? Math.round((r.totalAmount / totalExpense) * 1000) / 10 : 0,
    transactionCount: r.transactionCount,
  }))
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-03: Income/Expense Trend
// ═════════════════════════════════════════════════════════════════════════════

export function getIncomeExpenseTrend(authUserId: string, months: number): TrendDataPoint[] {
  const result: TrendDataPoint[] = []
  const today = new Date()
  let currentYear = today.getFullYear()
  let currentMonth = today.getMonth() + 1

  // Calculate start month
  let startMonth = currentMonth - months + 1
  let startYear = currentYear
  if (startMonth < 1) {
    startMonth += 12
    startYear -= 1
  }

  // Loop through each month
  for (let i = 0; i < months; i++) {
    const month = startMonth + i
    const year = month > 12 ? startYear + Math.floor((month - 1) / 12) : startYear
    const m = ((month - 1) % 12) + 1

    const overview = getMonthlyOverview(authUserId, year, m)

    result.push({
      month: `${year}-${String(m).padStart(2, '0')}`,
      totalIncome: overview.totalIncome,
      totalExpense: overview.totalExpense,
      averageExpense: 0, // Will be calculated after loop
    })
  }

  // Calculate average expense
  const avgExpense = result.length > 0
    ? Math.round(result.reduce((sum, r) => sum + r.totalExpense, 0) / result.length)
    : 0

  return result.map((r) => ({ ...r, averageExpense: avgExpense }))
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-04: Budget vs Actual
// ═════════════════════════════════════════════════════════════════════════════

export function getBudgetVsActual(authUserId: string, year: number, month: number): BudgetComparisonItem[] {
  const profileId = getProfileId(authUserId)
  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  // Get budgets for this month
  const budgetRows = db
    .select({
      budgetId: budgets.id,
      categoryId: categoryBudgets.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      limitAmount: categoryBudgets.limitAmount,
    })
    .from(budgets)
    .leftJoin(categoryBudgets, eq(budgets.id, categoryBudgets.budgetId))
    .leftJoin(categories, eq(categoryBudgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, profileId), eq(budgets.month, monthStr)))
    .all()

  // Get actual expenses by category
  const { startDate, endDate } = getMonthRange(year, month)
  const expenses = getExpensesByCategory(authUserId, startDate, endDate)
  const expenseMap = new Map(expenses.map((e) => [e.categoryId, e]))

  // Build result
  const result: BudgetComparisonItem[] = []

  for (const b of budgetRows) {
    if (!b.categoryId || !b.limitAmount) continue // Skip invalid budget entries

    const actual = expenseMap.get(b.categoryId)
    const actualAmount = actual?.totalAmount ?? 0
    const percentage = b.limitAmount > 0 ? Math.round((actualAmount / b.limitAmount) * 100) : 0

    result.push({
      categoryId: b.categoryId,
      categoryName: b.categoryName ?? 'Không danh mục',
      categoryIcon: b.categoryIcon,
      budgetAmount: b.limitAmount,
      actualAmount,
      percentage,
    })
  }

  return result.sort((a, b) => b.budgetAmount - a.budgetAmount)
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-05: Net Worth History (re-export)
// ═════════════════════════════════════════════════════════════════════════════

export { getNetWorthHistory }

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-06: Asset Allocation
// ═════════════════════════════════════════════════════════════════════════════

export function getAssetAllocation(authUserId: string) {
  const netWorthData = getNetWorth(authUserId)
  // Filter out debt and zero values
  return netWorthData.byType.filter((item) => item.totalValue > 0 && item.type !== 'debt')
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-07: Top Expenses
// ═════════════════════════════════════════════════════════════════════════════

export function getTopExpenses(authUserId: string, startDate: string, endDate: string, limit = 10) {
  const profileId = getProfileId(authUserId)

  return db
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
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, profileId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .orderBy(desc(transactions.amount))
    .limit(limit)
    .all()
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-02b: Transactions by Category (for drill-down)
// ═════════════════════════════════════════════════════════════════════════════

export function getTransactionsByCategory(authUserId: string, categoryId: string, startDate: string, endDate: string) {
  const profileId = getProfileId(authUserId)

  return db
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
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, profileId),
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.amount))
    .all()
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-08: Annual Summary
// ═════════════════════════════════════════════════════════════════════════════

export function getAnnualSummary(authUserId: string, year: number) {
  const monthly: Array<{ month: string; income: number; expense: number; difference: number }> = []

  for (let month = 1; month <= 12; month++) {
    const overview = getMonthlyOverview(authUserId, year, month)
    monthly.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      income: overview.totalIncome,
      expense: overview.totalExpense,
      difference: overview.difference,
    })
  }

  const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0)
  const totalExpense = monthly.reduce((sum, m) => sum + m.expense, 0)

  return {
    monthly,
    totalIncome,
    totalExpense,
    averageIncome: Math.round(totalIncome / 12),
    averageExpense: Math.round(totalExpense / 12),
  }
}
