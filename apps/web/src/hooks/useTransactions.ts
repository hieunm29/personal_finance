import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  QUERY_KEYS,
  type CreateTransactionInput,
  type TransactionFilter,
  type TransactionWithRelations,
  type PaginationMeta,
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

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTransactionInput) =>
      apiClient<{ data: unknown }>('/transactions', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard })
    },
  })
}
