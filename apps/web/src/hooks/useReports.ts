import { useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/apiClient'
import type {
  AnnualSummary,
  AssetAllocationItem,
  BudgetComparisonItem,
  CategoryExpense,
  MonthlyOverview,
  MonthComparison,
  NetWorthHistoryPoint,
  ReportInsight,
  ReportPeriodOverview,
  ReportTabId,
  Transaction,
  TrendDataPoint,
} from '@pf/shared'

type ExportReportParams = {
  tab: ReportTabId
  startDate: string
  endDate: string
  assetHistoryPeriod: '6' | '12' | 'all'
}

export function useReportOverview(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['reports', 'overview', startDate, endDate],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ startDate, endDate })
      return apiClient<{ data: ReportPeriodOverview }>(`/reports/overview?${query}`, { signal }).then(res => res.data)
    },
  })
}

export function useReportInsights(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['reports', 'insights', startDate, endDate],
    queryFn: ({ signal }) => {
      const query = new URLSearchParams({ startDate, endDate })
      return apiClient<{ data: ReportInsight[] }>(`/reports/insights?${query}`, { signal }).then(res => res.data)
    },
  })
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (params: ExportReportParams) => {
      const { tab, startDate, endDate } = params
      const query = new URLSearchParams(params)
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await fetch(`${base}/api/reports/export?${query}`, { credentials: 'include' })

      if (response.status === 401) {
        window.location.href = '/login'
        throw new Error('Phiên đăng nhập đã hết hạn.')
      }
      if (!response.ok) throw new Error('Không thể xuất báo cáo. Vui lòng thử lại.')

      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `personal-finance_report_${tab}_${startDate}_${endDate}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  })
}

// US-RPT-01: Monthly Overview
export function useMonthlyOverview(year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'overview', year, month],
    queryFn: () =>
      apiClient<{ data: { overview: MonthlyOverview; comparison: MonthComparison } }>(
        `/reports/overview?year=${year}&month=${month}`,
      ).then(res => res.data),
  })
}

// US-RPT-02: Expenses by Category
export function useExpensesByCategory(startDate?: string, endDate?: string, enabled = true) {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
    enabled,
    queryKey: ['reports', 'categories', startDate, endDate],
    queryFn: () =>
      apiClient<{ data: CategoryExpense[] }>(`/reports/categories${query}`).then(res => res.data),
  })
}

// US-RPT-02b: Transactions by Category (drill-down)
export function useTransactionsByCategory(categoryId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
    queryKey: ['reports', 'categoryTransactions', categoryId, startDate, endDate],
    queryFn: () =>
      apiClient<{ data: unknown[] }>(`/reports/categories/${categoryId}/transactions${query}`).then(res => res.data),
  })
}

// US-RPT-03: Income/Expense Trend
export function useIncomeExpenseTrend(months?: number, startDate?: string, endDate?: string, enabled = true) {
  const params = new URLSearchParams()
  if (months) params.set('months', String(months))
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
    enabled,
    queryKey: ['reports', 'trend', months, startDate, endDate],
    queryFn: () =>
      apiClient<{ data: TrendDataPoint[] }>(`/reports/trend${query}`).then(res => res.data),
  })
}

// US-RPT-04: Budget vs Actual
export function useBudgetVsActual(year: number, month: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['reports', 'budgetComparison', year, month],
    queryFn: () =>
      apiClient<{ data: BudgetComparisonItem[] }>(
        `/reports/budget-comparison?year=${year}&month=${month}`,
      ).then(res => res.data),
  })
}

// US-RPT-05: Net Worth History
export function useNetWorthHistory(limit?: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['reports', 'networthHistory', limit],
    queryFn: () => {
      const query = limit ? `?limit=${limit}` : ''
      return apiClient<{ data: NetWorthHistoryPoint[] }>(`/reports/networth-history${query}`).then(res => res.data)
    },
  })
}

// US-RPT-06: Asset Allocation
export function useAssetAllocation(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['reports', 'assetAllocation'],
    queryFn: () =>
      apiClient<{ data: AssetAllocationItem[] }>('/reports/asset-allocation').then(res => res.data),
  })
}

// US-RPT-07: Top Expenses
export function useTopExpenses(startDate?: string, endDate?: string, limit = 10, enabled = true) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  return useQuery({
    enabled,
    queryKey: ['reports', 'topExpenses', startDate, endDate, limit],
    queryFn: () =>
      apiClient<{ data: Transaction[] }>(`/reports/top-expenses?${params.toString()}`).then(res => res.data),
  })
}

// US-RPT-08: Annual Summary
export function useAnnualSummary(year: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['reports', 'annual', year],
    queryFn: () =>
      apiClient<{ data: AnnualSummary }>(`/reports/annual?year=${year}`).then(res => res.data),
  })
}
