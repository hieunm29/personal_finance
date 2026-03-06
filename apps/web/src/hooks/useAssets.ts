import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@pf/shared'
import type { Asset, NetWorthData, NetWorthHistoryPoint, AssetType } from '@pf/shared'
import type { CreateAssetInput, UpdateAssetInput } from '@pf/shared'
import { apiClient } from '../services/apiClient'

const ASSETS_KEY = QUERY_KEYS.assets

export function useAssets(type?: AssetType | AssetType[]) {
  const typeParam = Array.isArray(type) ? undefined : type
  return useQuery({
    queryKey: [...ASSETS_KEY, typeParam ?? 'all'],
    queryFn: () => apiClient<{ data: Asset[] }>(`/assets${typeParam ? `?type=${typeParam}` : ''}`),
  })
}

export function useNetWorth() {
  return useQuery({
    queryKey: [...ASSETS_KEY, 'networth'],
    queryFn: () => apiClient<{ data: NetWorthData }>('/assets/networth'),
  })
}

export function useNetWorthHistory(limit?: number) {
  return useQuery({
    queryKey: [...ASSETS_KEY, 'networth-history', limit],
    queryFn: () =>
      apiClient<{ data: NetWorthHistoryPoint[] }>(
        `/assets/networth-history${limit ? `?limit=${limit}` : ''}`,
      ),
  })
}

export function useCreateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAssetInput) =>
      apiClient<{ data: Asset }>('/assets', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  })
}

export function useUpdateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssetInput }) =>
      apiClient<{ data: Asset }>(`/assets/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  })
}

export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient<null>(`/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  })
}

export function useUpdateAssetValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newValue }: { id: string; newValue: number }) =>
      apiClient<{ data: Asset }>(`/assets/${id}/value`, { method: 'PUT', body: { newValue } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  })
}
