import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { transactions, categories, userProfiles, budgets, categoryBudgets } from '../db/schema'
import type { MonthlyOverview, MonthComparison, CategoryExpense, TrendDataPoint, BudgetComparisonItem, DateFilterPreset, DateRange, ReportInsight, ReportPeriodOverview, ReportTabId } from '@pf/shared'
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
  const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
  const end = new Date(0)
  end.setUTCFullYear(year, month, 0)
  return { startDate: `${monthKey}-01`, endDate: `${monthKey}-${end.getUTCDate()}` }
}

function isFullCalendarMonth(startDate: string, endDate: string): boolean {
  const [year, month] = startDate.split('-').map(Number)
  const monthRange = getMonthRange(year, month)
  return startDate === monthRange.startDate && endDate === monthRange.endDate
}

function getPreviousRange(startDate: string, endDate: string): DateRange | null {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (!(start <= end)) return null

  const millisecondsPerDay = 86_400_000
  const previousEnd = new Date(start.getTime() - millisecondsPerDay)
  const previousStart = new Date(previousEnd)
  const daysBetweenEndpoints = (end.getTime() - start.getTime()) / millisecondsPerDay
  previousStart.setUTCDate(isFullCalendarMonth(startDate, endDate)
    ? 1
    : previousEnd.getUTCDate() - daysBetweenEndpoints)

  if (previousStart.getUTCFullYear() < 1) return null
  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  }
}

function getChangePercent(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

function getSavingsRate(totalIncome: number, totalExpense: number): number | null {
  return totalIncome === 0 ? null : ((totalIncome - totalExpense) / totalIncome) * 100
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-01: Monthly Overview
// ═════════════════════════════════════════════════════════════════════════════

export function getMonthlyOverview(authUserId: string, year: number, month: number): MonthlyOverview {
  const { startDate, endDate } = getMonthRange(year, month)
  return getOverviewForRange(getProfileId(authUserId), startDate, endDate)
}

function getOverviewForRange(profileId: string, startDate: string, endDate: string): MonthlyOverview {
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
  const { startDate, endDate } = getMonthRange(year, month)
  const { changes } = getReportOverview(authUserId, startDate, endDate)
  return {
    incomeChangePercent: changes.incomePercent,
    expenseChangePercent: changes.expensePercent,
  }
}

export function getReportOverview(authUserId: string, startDate: string, endDate: string): ReportPeriodOverview {
  const profileId = getProfileId(authUserId)
  const current = getOverviewForRange(profileId, startDate, endDate)
  const previousRange = getPreviousRange(startDate, endDate)
  const previous = previousRange && {
    ...previousRange,
    overview: getOverviewForRange(profileId, previousRange.startDate, previousRange.endDate),
  }

  return {
    current,
    previous,
    changes: {
      incomePercent: getChangePercent(current.totalIncome, previous?.overview.totalIncome),
      expensePercent: getChangePercent(current.totalExpense, previous?.overview.totalExpense),
      savingsPercent: getChangePercent(current.difference, previous?.overview.difference),
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-02: Expenses by Category
// ═════════════════════════════════════════════════════════════════════════════

function getCategoryExpenseRows(profileId: string, startDate: string, endDate: string) {
  return db
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
}

export function getExpensesByCategory(authUserId: string, startDate: string, endDate: string): CategoryExpense[] {
  const profileId = getProfileId(authUserId)
  const rows = getCategoryExpenseRows(profileId, startDate, endDate)
  const previousRange = getPreviousRange(startDate, endDate)
  const previousAmounts = previousRange && new Map(
    getCategoryExpenseRows(profileId, previousRange.startDate, previousRange.endDate)
      .map((row) => [row.categoryId, row.totalAmount]),
  )

  const totalExpense = rows.reduce((sum, r) => sum + r.totalAmount, 0)

  return rows.map((row) => {
    const previousAmount = previousAmounts?.get(row.categoryId) ?? 0
    return {
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? 'Không danh mục',
      categoryIcon: row.categoryIcon,
      categoryColor: row.categoryColor,
      totalAmount: row.totalAmount,
      percentage: totalExpense > 0 ? Math.round((row.totalAmount / totalExpense) * 1000) / 10 : 0,
      transactionCount: row.transactionCount,
      ...(previousAmounts && {
        previousAmount,
        changePercent: getChangePercent(row.totalAmount, previousAmount),
      }),
    }
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-03: Income/Expense Trend
// ═════════════════════════════════════════════════════════════════════════════

export function getIncomeExpenseTrend(authUserId: string, months: number): TrendDataPoint[] {
  if (months < 1) return []
  const today = new Date()
  const { endDate } = getMonthRange(today.getFullYear(), today.getMonth() + 1)
  return getIncomeExpenseTrendRange(authUserId, getTrendStartDate(endDate, months), endDate)
}

function getTrendStartDate(endDate: string, months: number): string {
  const start = new Date(`${endDate.slice(0, 7)}-01T00:00:00Z`)
  const availableMonths = (start.getUTCFullYear() - 1) * 12 + start.getUTCMonth() + 1
  start.setUTCMonth(start.getUTCMonth() - Math.min(months, availableMonths) + 1)
  return start.toISOString().slice(0, 10)
}

export function getIncomeExpenseTrendRange(authUserId: string, startDate: string, endDate: string): TrendDataPoint[] {
  const profileId = getProfileId(authUserId)
  const monthKey = sql<string>`substr(${transactions.date}, 1, 7)`
  const monthlyTotals = db
    .select({
      month: monthKey,
      totalIncome: sql<number>`sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end)`,
      totalExpense: sql<number>`sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, profileId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ))
    .groupBy(monthKey)
    .all()
  const totalsByMonth = new Map(monthlyTotals.map((row) => [row.month, row]))

  const points: TrendDataPoint[] = []
  const monthStart = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (; monthStart <= end; monthStart.setUTCMonth(monthStart.getUTCMonth() + 1)) {
    const month = monthStart.toISOString().slice(0, 7)
    const { totalIncome = 0, totalExpense = 0 } = totalsByMonth.get(month) ?? {}
    points.push({
      month,
      totalIncome,
      totalExpense,
      averageExpense: 0,
      savingsRate: getSavingsRate(totalIncome, totalExpense),
    })
  }

  if (!points.length) return points
  const averageExpense = Math.round(points.reduce((sum, point) => sum + point.totalExpense, 0) / points.length)
  return points.map((point) => ({ ...point, averageExpense }))
}

// ═════════════════════════════════════════════════════════════════════════════
// US-RPT-04: Budget vs Actual
// ═════════════════════════════════════════════════════════════════════════════

export function getBudgetVsActual(authUserId: string, year: number, month: number): BudgetComparisonItem[] {
  return getBudgetComparisonForRange(getProfileId(authUserId), getMonthRange(year, month))
}

function getBudgetComparisonForRange(profileId: string, { startDate, endDate }: DateRange): BudgetComparisonItem[] {
  const monthStr = startDate.slice(0, 7)

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
  const expenses = getCategoryExpenseRows(profileId, startDate, endDate)
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

export function getReportInsights(authUserId: string, startDate: string, endDate: string): ReportInsight[] {
  const insights: ReportInsight[] = []
  const profileId = getProfileId(authUserId)
  const current = getOverviewForRange(profileId, startDate, endDate)
  const savingsRate = getSavingsRate(current.totalIncome, current.totalExpense)

  if (savingsRate !== null) {
    const trend = getIncomeExpenseTrendRange(authUserId, getTrendStartDate(endDate, 6), endDate)
    const monthlyRates = trend.flatMap(({ savingsRate }) => savingsRate === null ? [] : [savingsRate])
    const averageRate = monthlyRates.length
      ? monthlyRates.reduce((sum, rate) => sum + rate, 0) / monthlyRates.length
      : null
    insights.push({
      kind: 'savings',
      title: 'Tỷ lệ tiết kiệm',
      description: averageRate === null
        ? 'Tỷ lệ tiết kiệm trong kỳ đã chọn.'
        : `Tỷ lệ tiết kiệm trung bình trong 6 tháng đến cuối kỳ là ${averageRate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%.`,
      amount: current.difference,
      percentage: savingsRate,
    })
  }

  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    const [budget] = getBudgetComparisonForRange(profileId, { startDate, endDate })
      .sort((a, b) => b.actualAmount / b.budgetAmount - a.actualAmount / a.budgetAmount)
    if (budget) {
      const overBudget = budget.actualAmount > budget.budgetAmount
      insights.push({
        kind: 'budget',
        title: overBudget ? 'Vượt ngân sách' : 'Tiến độ ngân sách',
        description: `Chi tiêu trong kỳ cho ${budget.categoryName} ${overBudget ? 'đã vượt' : 'đang trong'} hạn mức tháng.`,
        amount: budget.actualAmount,
        percentage: budget.percentage,
        categoryId: budget.categoryId,
      })
    }
  }

  if (current.expenseCount > 0) {
    const [expense] = getTopExpenses(authUserId, startDate, endDate, 1)
    if (expense) {
      insights.push({
        kind: 'top_expense',
        title: 'Khoản chi lớn nhất',
        description: expense.note?.trim() || expense.category?.name || 'Không danh mục',
        amount: expense.amount,
        categoryId: expense.categoryId,
        date: expense.date,
      })
    }
  }

  return insights
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

type CsvCell = string | number | null | undefined

function csvCell(value: CsvCell): string {
  const raw = String(value ?? '')
  const safe = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

function formatCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function exportReportCsv(authUserId: string, tab: ReportTabId, startDate: string, endDate: string): string {
  switch (tab) {
    case 'overview': {
      const { current, previous, changes } = getReportOverview(authUserId, startDate, endDate)
      return formatCsv(['metric', 'current', 'previous', 'change_percent'], [
        ['start_date', startDate, previous?.startDate, null],
        ['end_date', endDate, previous?.endDate, null],
        ['total_income_cents', current.totalIncome, previous?.overview.totalIncome, changes.incomePercent],
        ['total_expense_cents', current.totalExpense, previous?.overview.totalExpense, changes.expensePercent],
        ['difference_cents', current.difference, previous?.overview.difference, changes.savingsPercent],
        ['transaction_count', current.transactionCount, previous?.overview.transactionCount, null],
        ['income_count', current.incomeCount, previous?.overview.incomeCount, null],
        ['expense_count', current.expenseCount, previous?.overview.expenseCount, null],
      ])
    }
    case 'categories': {
      const rows = getExpensesByCategory(authUserId, startDate, endDate)
      return formatCsv(
        ['category', 'total_amount_cents', 'previous_amount_cents', 'change_percent', 'percentage', 'transaction_count'],
        rows.map(({ categoryName, totalAmount, previousAmount, changePercent, percentage, transactionCount }) =>
          [categoryName, totalAmount, previousAmount, changePercent, percentage, transactionCount]),
      )
    }
    case 'trend': {
      const rows = getIncomeExpenseTrendRange(authUserId, startDate, endDate)
      return formatCsv(
        ['month', 'total_income_cents', 'total_expense_cents', 'average_expense_cents', 'savings_rate_percent'],
        rows.map(({ month, totalIncome, totalExpense, averageExpense, savingsRate }) =>
          [month, totalIncome, totalExpense, averageExpense, savingsRate]),
      )
    }
    case 'budget': {
      const monthKey = endDate.slice(0, 7)
      const [year, month] = monthKey.split('-').map(Number)
      const rows = getBudgetVsActual(authUserId, year, month)
      return formatCsv(
        ['month', 'category', 'budget_amount_cents', 'actual_amount_cents', 'percentage'],
        rows.map(({ categoryName, budgetAmount, actualAmount, percentage }) =>
          [monthKey, categoryName, budgetAmount, actualAmount, percentage]),
      )
    }
    case 'assets': {
      const startMonth = startDate.slice(0, 7)
      const endMonth = endDate.slice(0, 7)
      const allocation = getAssetAllocation(authUserId)
      const history = getNetWorthHistory(authUserId).filter(({ month }) => month >= startMonth && month <= endMonth)
      return formatCsv(
        ['row_type', 'month', 'asset_type', 'asset_label', 'total_value_cents', 'allocation_percent', 'net_worth_cents'],
        [
          ...allocation.map(({ type, label, totalValue, percentage }) =>
            ['allocation', null, type, label, totalValue, percentage, null]),
          ...history.map(({ month, netWorth }) => ['net_worth', month, null, null, null, null, netWorth]),
        ],
      )
    }
    case 'annual': {
      const { monthly } = getAnnualSummary(authUserId, Number(endDate.slice(0, 4)))
      return formatCsv(
        ['month', 'income_cents', 'expense_cents', 'difference_cents'],
        monthly.map(({ month, income, expense, difference }) => [month.padStart(7, '0'), income, expense, difference]),
      )
    }
  }
}
