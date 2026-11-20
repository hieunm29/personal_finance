import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import { budgets, categoryBudgets, categories, categoryGroups, userProfiles, transactions } from '../db/schema'
import type { CreateBudgetInput, UpdateBudgetInput } from '@pf/shared'
import type { Budget, BudgetWithProgress, BudgetHistory, BudgetOverview, BudgetOverviewCategory } from '@pf/shared'

function getProfileId(authUserId: string): string {
  const profile = db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.authUserId, authUserId)).get()
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return profile.id
}

export function getBudget(authUserId: string, month: string) {
  const profileId = getProfileId(authUserId)
  const budget = db.select().from(budgets)
    .where(and(eq(budgets.userId, profileId), eq(budgets.month, month)))
    .get()
  if (!budget) return null
  const cats = db.select().from(categoryBudgets).where(eq(categoryBudgets.budgetId, budget.id)).all()
  return { ...budget, categoryBudgets: cats }
}

function syncCategories(budgetId: string, profileId: string, items: Array<{ categoryId: string; limitAmount: number }>) {
  db.delete(categoryBudgets).where(eq(categoryBudgets.budgetId, budgetId)).run()
  for (const item of items) {
    if (item.limitAmount <= 0) continue
    const owned = db.select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, item.categoryId), eq(categories.userId, profileId)))
      .get()
    if (!owned) throw Object.assign(new Error(`Category not found`), { status: 400 })
    db.insert(categoryBudgets).values({ id: crypto.randomUUID(), budgetId, categoryId: item.categoryId, limitAmount: item.limitAmount }).run()
  }
}

export function upsertBudget(authUserId: string, data: CreateBudgetInput): Budget {
  const profileId = getProfileId(authUserId)
  const existing = db.select({ id: budgets.id }).from(budgets)
    .where(and(eq(budgets.userId, profileId), eq(budgets.month, data.month))).get()

  return db.transaction(() => {
    let budgetId: string
    if (existing) {
      db.update(budgets).set({ totalLimit: data.totalLimit, updatedAt: sql`(datetime('now'))` }).where(eq(budgets.id, existing.id)).run()
      budgetId = existing.id
    } else {
      budgetId = crypto.randomUUID()
      db.insert(budgets).values({ id: budgetId, userId: profileId, month: data.month, totalLimit: data.totalLimit }).run()
    }
    if (data.categories !== undefined) {
      syncCategories(budgetId, profileId, data.categories)
    }
    return db.select().from(budgets).where(eq(budgets.id, budgetId)).get()!
  })
}

export function updateBudget(authUserId: string, budgetId: string, data: UpdateBudgetInput): Budget {
  const profileId = getProfileId(authUserId)
  const budget = db.select().from(budgets).where(and(eq(budgets.id, budgetId), eq(budgets.userId, profileId))).get()
  if (!budget) throw Object.assign(new Error('Budget not found'), { status: 404 })

  return db.transaction(() => {
    if (data.totalLimit !== undefined) {
      db.update(budgets).set({ totalLimit: data.totalLimit, updatedAt: sql`(datetime('now'))` }).where(eq(budgets.id, budgetId)).run()
    }
    if (data.categories !== undefined) {
      syncCategories(budgetId, profileId, data.categories)
    }
    return db.select().from(budgets).where(eq(budgets.id, budgetId)).get()!
  })
}

export function deleteBudget(authUserId: string, budgetId: string): void {
  const profileId = getProfileId(authUserId)
  const budget = db.select().from(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, profileId)))
    .get()
  if (!budget) throw Object.assign(new Error('Budget not found'), { status: 404 })
  db.delete(budgets).where(eq(budgets.id, budgetId)).run()
}

export function copyPreviousBudget(authUserId: string, targetMonth: string): Budget {
  const [year, mon] = targetMonth.split('-').map(Number)
  const prevDate = new Date(year, mon - 2, 1)
  const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  const profileId = getProfileId(authUserId)
  const prevBudget = db.select().from(budgets)
    .where(and(eq(budgets.userId, profileId), eq(budgets.month, previousMonth)))
    .get()
  if (!prevBudget) throw Object.assign(new Error('Tháng trước chưa có ngân sách'), { status: 404 })

  const prevCategories = db.select().from(categoryBudgets)
    .where(eq(categoryBudgets.budgetId, prevBudget.id))
    .all()

  return upsertBudget(authUserId, {
    month: targetMonth,
    totalLimit: prevBudget.totalLimit,
    categories: prevCategories.map(c => ({ categoryId: c.categoryId, limitAmount: c.limitAmount })),
  })
}

export function getBudgetProgress(authUserId: string, month: string): BudgetWithProgress | null {
  const profileId = getProfileId(authUserId)
  const budget = db.select().from(budgets)
    .where(and(eq(budgets.userId, profileId), eq(budgets.month, month)))
    .get()
  if (!budget) return null

  const txAggregate = db.select({
    categoryId: transactions.categoryId,
    spent: sql<number>`SUM(${transactions.amount})`,
  })
    .from(transactions)
    .where(and(
      eq(transactions.userId, profileId),
      eq(transactions.type, 'expense'),
      sql`${transactions.date} LIKE ${month + '-%'}`,
    ))
    .groupBy(transactions.categoryId)
    .all()

  const spentMap = new Map(txAggregate.map(r => [r.categoryId, r.spent ?? 0]))
  const totalSpent = txAggregate.reduce((sum, r) => sum + (r.spent ?? 0), 0)

  const catBudgets = db.select({
    id: categoryBudgets.id,
    budgetId: categoryBudgets.budgetId,
    categoryId: categoryBudgets.categoryId,
    limitAmount: categoryBudgets.limitAmount,
    categoryName: categories.name,
    categoryIcon: categories.icon,
    categoryColor: categories.color,
  })
    .from(categoryBudgets)
    .leftJoin(categories, eq(categoryBudgets.categoryId, categories.id))
    .where(eq(categoryBudgets.budgetId, budget.id))
    .all()

  const categoriesProgress = catBudgets.map(cb => {
    const spent = spentMap.get(cb.categoryId) ?? 0
    const remaining = cb.limitAmount - spent
    const percentage = cb.limitAmount > 0 ? Math.round(spent / cb.limitAmount * 100) : 0
    return {
      id: cb.id,
      budgetId: cb.budgetId,
      categoryId: cb.categoryId,
      limitAmount: cb.limitAmount,
      category: { id: cb.categoryId, name: cb.categoryName ?? '', icon: cb.categoryIcon ?? null, color: cb.categoryColor ?? null },
      spent,
      remaining,
      percentage,
    }
  })

  const remaining = budget.totalLimit - totalSpent
  const percentage = budget.totalLimit > 0 ? Math.round(totalSpent / budget.totalLimit * 100) : 0

  return { ...budget, totalSpent, remaining, percentage, categories: categoriesProgress }
}

export function getBudgetHistory(authUserId: string): BudgetHistory[] {
  const profileId = getProfileId(authUserId)
  const allBudgets = db.select().from(budgets).where(eq(budgets.userId, profileId)).orderBy(sql`${budgets.month} DESC`).all()
  if (allBudgets.length === 0) return []

  const spentByMonth = db.select({
    month: sql<string>`substr(${transactions.date}, 1, 7)`,
    totalSpent: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
  })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.type, 'expense')))
    .groupBy(sql`substr(${transactions.date}, 1, 7)`)
    .all()

  const spentMap = new Map(spentByMonth.map(r => [r.month, r.totalSpent]))

  return allBudgets.map(b => {
    const totalSpent = spentMap.get(b.month) ?? 0
    return { month: b.month, totalLimit: b.totalLimit, totalSpent, overage: totalSpent - b.totalLimit }
  })
}

function monthMetrics(month: string, totalSpent: number, totalLimit: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const daysElapsed = month < currentMonth ? daysInMonth : month > currentMonth ? 0 : now.getDate()
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0)
  const averageDailySpend = daysElapsed > 0 ? Math.round(totalSpent / daysElapsed) : 0
  const dailyAllowance = daysRemaining > 0 ? Math.round((totalLimit - totalSpent) / daysRemaining) : 0
  const projectedTotal = daysElapsed > 0 ? Math.round(averageDailySpend * daysInMonth) : 0
  const percentage = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0
  return { daysInMonth, daysElapsed, daysRemaining, averageDailySpend, dailyAllowance, projectedTotal, projectedOverage: projectedTotal - totalLimit, percentage }
}

export function getBudgetOverview(authUserId: string, month: string): BudgetOverview {
  const profileId = getProfileId(authUserId)
  const budget = db.select().from(budgets).where(and(eq(budgets.userId, profileId), eq(budgets.month, month))).get() ?? null
  const budgetCategoryRows = budget ? db.select().from(categoryBudgets).where(eq(categoryBudgets.budgetId, budget.id)).all() : []
  const spentRows = db.select({ categoryId: transactions.categoryId, spent: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions).where(and(eq(transactions.userId, profileId), eq(transactions.type, 'expense'), sql`${transactions.date} LIKE ${month + '-%'}`))
    .groupBy(transactions.categoryId).all()
  const spentMap = new Map(spentRows.map((row) => [row.categoryId, row.spent ?? 0]))
  const totalSpent = spentRows.reduce((sum, row) => sum + (row.spent ?? 0), 0)
  const totalLimit = budget?.totalLimit ?? 0
  const limitMap = new Map(budgetCategoryRows.map((item) => [item.categoryId, item.limitAmount]))
  const expenseCategoryRows = db.select({
    id: categories.id,
    name: categories.name,
    icon: categories.icon,
    color: categories.color,
    groupName: categoryGroups.name,
  }).from(categories).leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(eq(categories.userId, profileId), eq(categories.type, 'expense'))).all()
  const categoriesWithProgress: BudgetOverviewCategory[] = expenseCategoryRows.map((category) => {
    const spent = spentMap.get(category.id) ?? 0
    const limitAmount = limitMap.get(category.id) ?? null
    const percentage = limitAmount && limitAmount > 0 ? Math.round((spent / limitAmount) * 100) : 0
    return { categoryId: category.id, name: category.name, icon: category.icon, color: category.color, groupName: category.groupName, spent, limitAmount, percentage, remaining: limitAmount === null ? null : limitAmount - spent }
  })
  const budgetedCategories = categoriesWithProgress.filter((category) => category.limitAmount !== null)
  const unbudgetedCategories = categoriesWithProgress.filter((category) => category.limitAmount === null)
  const metrics = monthMetrics(month, totalSpent, totalLimit)
  const history = getBudgetHistory(authUserId).slice(0, 6)
  const allocatedAmount = budgetCategoryRows.reduce((sum, item) => sum + item.limitAmount, 0)
  const remaining = totalLimit - totalSpent
  return {
    month,
    budget: budget ? { ...budget, categoryBudgets: budgetCategoryRows } : null,
    totalSpent,
    remaining,
    percentage: metrics.percentage,
    allocatedAmount,
    unallocatedAmount: totalLimit - allocatedAmount,
    daysInMonth: metrics.daysInMonth,
    daysElapsed: metrics.daysElapsed,
    daysRemaining: metrics.daysRemaining,
    dailyAllowance: metrics.dailyAllowance,
    averageDailySpend: metrics.averageDailySpend,
    projectedTotal: metrics.projectedTotal,
    projectedOverage: metrics.projectedOverage,
    status: metrics.percentage >= 100 ? 'over' : metrics.percentage >= 80 ? 'warning' : 'on_track',
    categories: budgetedCategories,
    unbudgetedCategories,
    history,
  }
}

export function getBudgetSuggestion(authUserId: string, month: string) {
  const profileId = getProfileId(authUserId)
  const [year, monthNumber] = month.split('-').map(Number)
  const target = new Date(year, monthNumber - 1, 1)
  const start = new Date(target.getFullYear(), target.getMonth() - 3, 1)
  const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  const endMonth = `${month}-01`
  const rows = db.select({ categoryId: transactions.categoryId, amount: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions).where(and(eq(transactions.userId, profileId), eq(transactions.type, 'expense'), sql`${transactions.date} >= ${startMonth}`, sql`${transactions.date} < ${endMonth}`))
    .groupBy(transactions.categoryId).all()
  const round = (value: number) => Math.ceil(value / 10_000) * 10_000
  const categorySuggestions = rows.filter((row) => row.amount > 0).map((row) => ({ categoryId: row.categoryId, limitAmount: round((row.amount ?? 0) / 3 * 1.1) }))
  const total = round(categorySuggestions.reduce((sum, item) => sum + item.limitAmount, 0))
  return { month, totalLimit: total, categories: categorySuggestions, basedOnMonths: 3 }
}
