import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { getAssetOverview } from '../../services/assetService'
import { getBudgetProgress } from '../../services/budgetService'
import { getExpensesByCategory, getMonthRange, getMonthlyOverview } from '../../services/reportService'
import { centsToVnd, currentMonthVN, json, toolFail } from './helpers'
import type { ToolContext } from './index'

const MONTH_PATTERN = '^\\d{4}-\\d{2}$'

function parseMonth(month: string | undefined): { month: string; year: number; monthNumber: number } {
  const value = month || currentMonthVN()
  const [year, monthNumber] = value.split('-').map(Number)
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) toolFail(`Tháng "${value}" không hợp lệ, cần dạng YYYY-MM.`)
  return { month: value, year, monthNumber }
}

/** Các tool chỉ ĐỌC dữ liệu để trả lời câu hỏi thống kê. */
export function buildReportTools(ctx: ToolContext) {
  const monthlySummaryTool = betaTool({
    name: 'get_monthly_summary',
    description:
      'Tổng thu, tổng chi, chênh lệch và chi tiêu theo từng danh mục của một tháng. ' +
      'Dùng cho "tháng này tiêu bao nhiêu", "tháng trước chi nhiều nhất vào đâu".',
    inputSchema: {
      type: 'object',
      properties: { month: { type: 'string', pattern: MONTH_PATTERN, description: 'YYYY-MM; bỏ trống = tháng hiện tại' } },
      additionalProperties: false,
    },
    run: async (input) => {
      const { month, year, monthNumber } = parseMonth(input.month)
      const overview = getMonthlyOverview(ctx.authUserId, year, monthNumber)
      const { startDate, endDate } = getMonthRange(year, monthNumber)
      const byCategory = getExpensesByCategory(ctx.authUserId, startDate, endDate)
      return json({
        month,
        totalIncomeVnd: centsToVnd(overview.totalIncome),
        totalExpenseVnd: centsToVnd(overview.totalExpense),
        differenceVnd: centsToVnd(overview.difference),
        transactionCount: overview.transactionCount,
        expensesByCategory: byCategory.slice(0, 10).map((item) => ({
          category: item.categoryName,
          amountVnd: centsToVnd(item.totalAmount),
          percentage: item.percentage,
        })),
      })
    },
  })

  const budgetStatusTool = betaTool({
    name: 'get_budget_status',
    description: 'Tình trạng ngân sách của một tháng: hạn mức, đã chi, còn lại theo từng danh mục. Dùng cho "còn bao nhiêu ngân sách".',
    inputSchema: {
      type: 'object',
      properties: { month: { type: 'string', pattern: MONTH_PATTERN, description: 'YYYY-MM; bỏ trống = tháng hiện tại' } },
      additionalProperties: false,
    },
    run: async (input) => {
      const { month } = parseMonth(input.month)
      const budget = getBudgetProgress(ctx.authUserId, month)
      if (!budget) return json({ month, hasBudget: false })
      return json({
        month,
        hasBudget: true,
        totalLimitVnd: centsToVnd(budget.totalLimit),
        totalSpentVnd: centsToVnd(budget.totalSpent),
        remainingVnd: centsToVnd(budget.remaining),
        percentage: budget.percentage,
        categories: budget.categories
          .filter((item) => item.limitAmount > 0)
          .map((item) => ({
            category: item.category.name,
            limitVnd: centsToVnd(item.limitAmount),
            spentVnd: centsToVnd(item.spent),
            remainingVnd: centsToVnd(item.remaining),
            percentage: item.percentage,
          })),
      })
    },
  })

  const netWorthTool = betaTool({
    name: 'get_net_worth',
    description: 'Tổng tài sản ròng, tổng tài sản, tổng nợ và phân bổ theo loại tài sản. Dùng cho "tôi có bao nhiêu tài sản".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const overview = getAssetOverview(ctx.authUserId)
      return json({
        netWorthVnd: centsToVnd(overview.netWorth),
        totalAssetsVnd: centsToVnd(overview.totalAssets),
        totalDebtVnd: centsToVnd(overview.totalDebt),
        changeFromLastMonthVnd: overview.netWorthDelta === null ? null : centsToVnd(overview.netWorthDelta),
        allocation: overview.allocation.map((item) => ({
          type: item.label,
          valueVnd: centsToVnd(item.totalValue),
          percentage: item.percentage,
        })),
      })
    },
  })

  return [monthlySummaryTool, budgetStatusTool, netWorthTool]
}
