import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import * as reportService from '../services/reportService'

type Variables = { userId: string }
const app = new Hono<{ Variables: Variables }>()

const reportDate = z.string().date().refine((date) => !date.startsWith('0000-'))
const reportDateRangeQuery = z.object({ startDate: reportDate, endDate: reportDate })
const optionalReportDateRangeQuery = reportDateRangeQuery.partial()
const dateRangeMessage = 'Provide startDate and endDate together, with startDate on or before endDate'

function isOrderedDateRange({ startDate, endDate }: { startDate?: string; endDate?: string }): boolean {
  return startDate === undefined ? endDate === undefined : endDate !== undefined && startDate <= endDate
}

const overviewQuery = z.union([
  reportDateRangeQuery.refine(isOrderedDateRange, dateRangeMessage),
  z.object({
    year: z.string().transform(Number).pipe(z.number().int().min(1).max(9999)),
    month: z.string().transform(Number).pipe(z.number().int().min(1).max(12)),
    startDate: z.never().optional(),
    endDate: z.never().optional(),
  }),
])

// US-RPT-01: Monthly Overview
app.get('/overview', zValidator('query', overviewQuery), async (c) => {
  const query = c.req.valid('query')
  const userId = c.get('userId')

  if (!('year' in query)) {
    return c.json({ data: reportService.getReportOverview(userId, query.startDate, query.endDate) })
  }

  const { startDate, endDate } = reportService.getMonthRange(query.year, query.month)
  const { current, changes } = reportService.getReportOverview(userId, startDate, endDate)
  return c.json({
    data: {
      overview: current,
      comparison: {
        incomeChangePercent: changes.incomePercent,
        expenseChangePercent: changes.expensePercent,
      },
    },
  })
})

app.get('/insights', zValidator('query', reportDateRangeQuery.refine(isOrderedDateRange, dateRangeMessage)), async (c) => {
  const { startDate, endDate } = c.req.valid('query')
  const data = reportService.getReportInsights(c.get('userId'), startDate, endDate)
  return c.json({ data })
})

// US-RPT-02: Expenses by Category
app.get('/categories', zValidator('query', optionalReportDateRangeQuery.refine(isOrderedDateRange, dateRangeMessage)), async (c) => {
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
app.get('/trend', zValidator('query', optionalReportDateRangeQuery.extend({
  months: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
}).refine(isOrderedDateRange, dateRangeMessage)), async (c) => {
  const { months, startDate, endDate } = c.req.valid('query')
  const userId = c.get('userId')

  const data = startDate && endDate
    ? reportService.getIncomeExpenseTrendRange(userId, startDate, endDate)
    : reportService.getIncomeExpenseTrend(userId, months ?? 6)

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
