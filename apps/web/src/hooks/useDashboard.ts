import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type DashboardData } from '@pf/shared'
import { apiClient } from '../services/apiClient'

export function useDashboard(month?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.dashboard, month ?? 'current'],
    queryFn: () =>
      apiClient<{ data: DashboardData }>('/dashboard' + (month ? '?month=' + month : '')),
    staleTime: 30_000,
  })
}
