import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import * as reportService from '../services/reportService'

type Variables = { userId: string }
const app = new Hono<{ Variables: Variables }>()

// US-RPT-01: Monthly Overview
app.get('/overview', zValidator('query', z.object({
  year: z.string().transform(Number),
  month: z.string().transform(Number),
})), async (c) => {
  const { year, month } = c.req.valid('query')
  const userId = c.get('userId')

  const overview = reportService.getMonthlyOverview(userId, year, month)
  const comparison = reportService.getPreviousMonthComparison(userId, year, month)

  return c.json({ data: { overview, comparison } })
})

// US-RPT-02: Expenses by Category
app.get('/categories', zValidator('query', z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})), async (c) => {
  const { startDate, endDate } = c.req.valid('query')
  const userId = c.get('userId')

  // Default to current month if not provided
  const { startDate: s, endDate: e } = startDate && endDate
    ? { startDate, endDate }
    : reportService.getMonthRange(new Date().getFullYear(), new Date().getMonth() + 1)

  const data = reportService.getExpensesByCategory(userId, s, e)
  return c.json({ data })
})

// US-RPT-02: Transactions by Category (drill-down) — MUST be before /:id
app.get('/categories/:categoryId/transactions', zValidator('query', z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})), async (c) => {
  const { categoryId } = c.req.param()
  const { startDate, endDate } = c.req.valid('query')
  const userId = c.get('userId')

  const { startDate: s, endDate: e } = startDate && endDate
    ? { startDate, endDate }
    : reportService.getMonthRange(new Date().getFullYear(), new Date().getMonth() + 1)

  const data = reportService.getTransactionsByCategory(userId, categoryId, s, e)
  return c.json({ data })
})

// US-RPT-03: Income/Expense Trend
app.get('/trend', zValidator('query', z.object({
  months: z.string().transform(Number).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})), async (c) => {
  const { months, startDate, endDate } = c.req.valid('query')
  const userId = c.get('userId')

  let data: ReturnType<typeof reportService.getIncomeExpenseTrend>

  if (startDate && endDate && !months) {
    // Custom range: aggregate by month manually
    const start = new Date(startDate)
    const end = new Date(endDate)
    const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
    data = reportService.getIncomeExpenseTrend(userId, Math.min(monthCount, 12))
  } else {
    const m = months ?? 6
    data = reportService.getIncomeExpenseTrend(userId, m)
  }

  return c.json({ data })
})

// US-RPT-04: Budget vs Actual
app.get('/budget-comparison', zValidator('query', z.object({
  year: z.string().transform(Number),
  month: z.string().transform(Number),
})), async (c) => {
  const { year, month } = c.req.valid('query')
  const userId = c.get('userId')

  const data = reportService.getBudgetVsActual(userId, year, month)
  return c.json({ data })
})

// US-RPT-05: Net Worth History
app.get('/networth-history', zValidator('query', z.object({
  limit: z.string().transform(Number).optional(),
})), async (c) => {
  const { limit } = c.req.valid('query')
  const userId = c.get('userId')

  const data = reportService.getNetWorthHistory(userId, limit)
  return c.json({ data })
})

// US-RPT-06: Asset Allocation
app.get('/asset-allocation', async (c) => {
  const userId = c.get('userId')

  const data = reportService.getAssetAllocation(userId)
  return c.json({ data })
})

// US-RPT-07: Top Expenses
app.get('/top-expenses', zValidator('query', z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().transform(Number).optional().default('10'),
})), async (c) => {
  const { startDate, endDate, limit } = c.req.valid('query')
  const userId = c.get('userId')

  const { startDate: s, endDate: e } = startDate && endDate
    ? { startDate, endDate }
    : reportService.getMonthRange(new Date().getFullYear(), new Date().getMonth() + 1)

  const data = reportService.getTopExpenses(userId, s, e, limit)
  return c.json({ data })
})

// US-RPT-08: Annual Summary
app.get('/annual', zValidator('query', z.object({
  year: z.string().transform(Number),
})), async (c) => {
  const { year } = c.req.valid('query')
  const userId = c.get('userId')

  const data = reportService.getAnnualSummary(userId, year)
  return c.json({ data })
})

export default app
