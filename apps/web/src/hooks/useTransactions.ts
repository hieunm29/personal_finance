import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  QUERY_KEYS,
  type CreateTransactionInput,
  type CreateTransferInput,
  type UpdateTransactionInput,
  type TransactionFilter,
  type TransactionWithRelations,
  type PaginationMeta,
  type TransactionAnalytics,
} from '@pf/shared'
import { apiClient } from '../services/apiClient'

// Extended meta trả về từ GET /transactions (kèm aggregate)
export interface TransactionsMeta extends PaginationMeta {
  totalIncome: number
  totalExpense: number
}

export interface TransactionsResponse {
  data: TransactionWithRelations[]
  meta: TransactionsMeta
}

function buildParams(filters: TransactionFilter): string {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.set(key, String(val))
    }
  }
  return params.toString()
}

export function useTransactions(filters: TransactionFilter) {
  return useQuery({
    queryKey: [...QUERY_KEYS.transactions, filters],
    queryFn: () =>
      apiClient<TransactionsResponse>(`/transactions?${buildParams(filters)}`),
  })
}

export function useInfiniteTransactions(filters: TransactionFilter) {
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.transactions, 'infinite', { ...filters, page: undefined }],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => apiClient<TransactionsResponse>(
      `/transactions?${buildParams({ ...filters, page: pageParam })}`,
      { signal },
    ),
    getNextPageParam: (lastPage) => lastPage.meta.page < lastPage.meta.totalPages
      ? lastPage.meta.page + 1
      : undefined,
  })
}

export function useTransactionAnalytics(filters: TransactionFilter) {
  const { page: _page, limit: _limit, ...aggregateFilters } = filters
  return useQuery({
    queryKey: [...QUERY_KEYS.transactions, 'analytics', aggregateFilters],
    queryFn: ({ signal }) => apiClient<{ data: TransactionAnalytics }>(
      `/transactions/analytics?${buildParams({ ...aggregateFilters, page: 1, limit: 20 })}`,
      { signal },
    ),
  })
}

export function useExportTransactions() {
  return useMutation({
    mutationFn: async (filters: TransactionFilter) => {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const response = await fetch(`${base}/api/transactions/export?${buildParams(filters)}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Không thể xuất giao dịch. Vui lòng thử lại.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'giao-dich.csv'
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
  })
}

function useInvalidateTransactionData() {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of [
      QUERY_KEYS.transactions, QUERY_KEYS.dashboard, QUERY_KEYS.budgets,
      QUERY_KEYS.budgetProgress, QUERY_KEYS.assets, QUERY_KEYS.wallets, ['reports'],
    ]) void queryClient.invalidateQueries({ queryKey })
  }
}

export function useCreateTransaction() {
  const invalidate = useInvalidateTransactionData()
  return useMutation({
    mutationFn: (data: CreateTransactionInput) =>
      apiClient<{ data: unknown }>('/transactions', { method: 'POST', body: data }),
    onSuccess: invalidate,
  })
}

/** Chuyển tiền giữa 2 tài khoản; số dư cả hai tài khoản thay đổi nên làm mới cả tài sản. */
export function useCreateTransfer() {
  const invalidate = useInvalidateTransactionData()
  return useMutation({
    mutationFn: (data: CreateTransferInput) =>
      apiClient<{ data: unknown }>('/transactions/transfer', { method: 'POST', body: data }),
    onSuccess: invalidate,
  })
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.transactions, id],
    queryFn: () => apiClient<{ data: TransactionWithRelations }>(`/transactions/${id}`),
    enabled: !!id,
  })
}

export function useUpdateTransaction(id: string) {
  const invalidate = useInvalidateTransactionData()
  return useMutation({
    mutationFn: (data: UpdateTransactionInput) =>
      apiClient<{ data: unknown }>(`/transactions/${id}`, { method: 'PUT', body: data }),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTransactionData()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<null>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
