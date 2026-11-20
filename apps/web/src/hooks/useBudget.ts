import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  QUERY_KEYS,
  type Budget,
  type CategoryBudget,
  type BudgetWithProgress,
  type BudgetHistory,
  type CreateBudgetInput,
  type UpdateBudgetInput,
  type CopyPreviousBudgetInput,
  type BudgetOverview,
} from '@pf/shared'
import { apiClient } from '../services/apiClient'

export function useBudget(month: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.budgets, month],
    queryFn: () =>
      apiClient<{ data: (Budget & { categoryBudgets: CategoryBudget[] }) | null }>(
        `/budgets?month=${month}`,
      ),
    enabled: options?.enabled !== false && !!month,
  })
}

export function useBudgetProgress(month: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.budgetProgress, month],
    queryFn: () =>
      apiClient<{ data: BudgetWithProgress | null }>(`/budgets/progress?month=${month}`),
    enabled: !!month,
  })
}

export function useBudgetHistory() {
  return useQuery({
    queryKey: QUERY_KEYS.budgetHistory,
    queryFn: () => apiClient<{ data: BudgetHistory[] }>('/budgets/history'),
  })
}

export function useBudgetOverview(month: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.budgets, 'overview', month],
    queryFn: () => apiClient<{ data: BudgetOverview }>(`/budgets/overview?month=${month}`),
    enabled: !!month,
  })
}

export function useBudgetSuggestion(month: string, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.budgets, 'suggestion', month],
    queryFn: () => apiClient<{ data: { month: string; totalLimit: number; categories: Array<{ categoryId: string; limitAmount: number }>; basedOnMonths: number } }>(`/budgets/suggestion?month=${month}`),
    enabled: Boolean(month) && enabled,
  })
}

export function useUpsertBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBudgetInput) =>
      apiClient<{ data: unknown }>('/budgets', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgets })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetProgress })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetHistory })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard })
    },
  })
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBudgetInput }) =>
      apiClient<{ data: unknown }>(`/budgets/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgets })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetProgress })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetHistory })
    },
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient<null>(`/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgets })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetProgress })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetHistory })
    },
  })
}

export function useCopyPreviousBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CopyPreviousBudgetInput) =>
      apiClient<{ data: unknown }>('/budgets/copy-previous', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgets })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetProgress })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgetHistory })
    },
  })
}
