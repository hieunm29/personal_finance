import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/apiClient'
import type { MonthlyOverview, MonthComparison, CategoryExpense, TrendDataPoint, BudgetComparisonItem, AnnualSummary, AssetAllocationItem } from '@pf/shared'

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
export function useExpensesByCategory(startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
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
export function useIncomeExpenseTrend(months?: number, startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (months) params.set('months', String(months))
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
    queryKey: ['reports', 'trend', months, startDate, endDate],
    queryFn: () =>
      apiClient<{ data: TrendDataPoint[] }>(`/reports/trend${query}`).then(res => res.data),
  })
}

// US-RPT-04: Budget vs Actual
export function useBudgetVsActual(year: number, month: number) {
  return useQuery({
    queryKey: ['reports', 'budgetComparison', year, month],
    queryFn: () =>
      apiClient<{ data: BudgetComparisonItem[] }>(
        `/reports/budget-comparison?year=${year}&month=${month}`,
      ).then(res => res.data),
  })
}

// US-RPT-05: Net Worth History
export function useNetWorthHistory(limit?: number) {
  return useQuery({
    queryKey: ['reports', 'networthHistory', limit],
    queryFn: () => {
      const query = limit ? `?limit=${limit}` : ''
      return apiClient<{ data: unknown[] }>(`/reports/networth-history${query}`).then(res => res.data)
    },
  })
}

// US-RPT-06: Asset Allocation
export function useAssetAllocation() {
  return useQuery({
    queryKey: ['reports', 'assetAllocation'],
    queryFn: () =>
      apiClient<{ data: AssetAllocationItem[] }>('/reports/asset-allocation').then(res => res.data),
  })
}

// US-RPT-07: Top Expenses
export function useTopExpenses(startDate?: string, endDate?: string, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  return useQuery({
    queryKey: ['reports', 'topExpenses', startDate, endDate, limit],
    queryFn: () =>
      apiClient<{ data: unknown[] }>(`/reports/top-expenses?${params.toString()}`).then(res => res.data),
  })
}

// US-RPT-08: Annual Summary
export function useAnnualSummary(year: number) {
  return useQuery({
    queryKey: ['reports', 'annual', year],
    queryFn: () =>
      apiClient<{ data: AnnualSummary }>(`/reports/annual?year=${year}`).then(res => res.data),
  })
}
