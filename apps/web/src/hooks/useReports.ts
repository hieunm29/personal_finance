import { useMutation, useQuery } from '@tanstack/react-query'
import { authClient } from '../lib/auth-client'
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
  UserProfile,
} from '@pf/shared'

type ExportReportParams = {
  tab: ReportTabId
  startDate: string
  endDate: string
  assetHistoryPeriod: '6' | '12' | 'all'
}

const reportFreshness = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
} as const

function useReportUserId() {
  const session = authClient.useSession()
  return !session.isPending && !session.isRefetching && !session.error ? session.data?.user.id : undefined
}

function useReportQuery<T>(path: string, enabled = true) {
  const userId = useReportUserId()
  return useQuery({
    ...reportFreshness,
    queryKey: ['reports', userId, path],
    enabled: Boolean(userId) && enabled,
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error('Chưa xác định tài khoản.')
      const { data } = await apiClient<{ data: T }>(path, {
        signal, cache: 'no-store', headers: { 'X-Report-Account': userId },
      })
      return data
    },
  })
}

export function useReportProfile() {
  const userId = useReportUserId()
  return useQuery({
    ...reportFreshness,
    queryKey: ['reports', userId, 'profile'],
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient<{ data: UserProfile }>('/settings/profile', { signal, cache: 'no-store' })
      if (data.authUserId !== userId) throw new Error('Tài khoản đã thay đổi.')
      return data
    },
  })
}

function reportPath(route: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return query.size ? `/reports/${route}?${query}` : `/reports/${route}`
}

export function useReportOverview(startDate: string, endDate: string, enabled = true) {
  return useReportQuery<ReportPeriodOverview>(reportPath('overview', { startDate, endDate }), enabled)
}

export function useReportInsights(startDate: string, endDate: string, enabled = true) {
  return useReportQuery<ReportInsight[]>(reportPath('insights', { startDate, endDate }), enabled)
}

export function useExportReport() {
  const userId = useReportUserId()
  return useMutation({
    mutationFn: async (params: ExportReportParams) => {
      if (!userId) throw new Error('Chưa xác định tài khoản.')
      const { tab, startDate, endDate } = params
      const query = new URLSearchParams(params)
      const base = import.meta.env.VITE_API_URL || window.location.origin
      const response = await fetch(`${base}/api/reports/export?${query}`, {
        credentials: 'include', headers: { 'X-Report-Account': userId }, cache: 'no-store',
      })

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

export function useMonthlyOverview(year: number, month: number) {
  return useReportQuery<{ overview: MonthlyOverview; comparison: MonthComparison }>(reportPath('overview', { year, month }))
}

export function useExpensesByCategory(startDate?: string, endDate?: string, enabled = true) {
  return useReportQuery<CategoryExpense[]>(reportPath('categories', { startDate, endDate }), enabled)
}

export function useTransactionsByCategory(categoryId: string, startDate?: string, endDate?: string) {
  return useReportQuery<Transaction[]>(reportPath(`categories/${encodeURIComponent(categoryId)}/transactions`, { startDate, endDate }))
}

export function useIncomeExpenseTrend(months?: number, startDate?: string, endDate?: string, enabled = true) {
  return useReportQuery<TrendDataPoint[]>(reportPath('trend', { months, startDate, endDate }), enabled)
}

export function useBudgetVsActual(year: number, month: number, enabled = true) {
  return useReportQuery<BudgetComparisonItem[]>(reportPath('budget-comparison', { year, month }), enabled)
}

export function useNetWorthHistory(limit?: number, enabled = true) {
  return useReportQuery<NetWorthHistoryPoint[]>(reportPath('networth-history', { limit }), enabled)
}

export function useAssetAllocation(enabled = true) {
  return useReportQuery<AssetAllocationItem[]>('/reports/asset-allocation', enabled)
}

export function useTopExpenses(startDate?: string, endDate?: string, limit = 10, enabled = true) {
  return useReportQuery<Transaction[]>(reportPath('top-expenses', { startDate, endDate, limit }), enabled)
}

export function useAnnualSummary(year: number, enabled = true) {
  return useReportQuery<AnnualSummary>(reportPath('annual', { year }), enabled)
}
