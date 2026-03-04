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

export function useUpsertBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBudgetInput) =>
      apiClient<{ data: unknown }>('/budgets', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgets })
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
    },
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient<null>(`/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.budgets })
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
    },
  })
}
