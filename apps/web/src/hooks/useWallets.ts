import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type Wallet } from '@pf/shared'
import { apiClient } from '../services/apiClient'

export function useWallets() {
  return useQuery({
    queryKey: QUERY_KEYS.wallets,
    queryFn: () => apiClient<{ data: Wallet[] }>('/wallets'),
  })
}
