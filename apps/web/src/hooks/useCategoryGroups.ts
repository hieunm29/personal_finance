import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS, type CategoryType } from '@pf/shared'
import type { CategoryGroup, CreateCategoryGroupInput, UpdateCategoryGroupInput } from '@pf/shared'
import { apiClient } from '../services/apiClient'

export function useCategoryGroups(type?: CategoryType) {
  return useQuery({
    queryKey: [...QUERY_KEYS.categoryGroups, { type }],
    queryFn: () => {
      const qs = type ? `?type=${type}` : ''
      return apiClient<{ data: CategoryGroup[] }>(`/category-groups${qs}`)
    },
  })
}

export function useCreateCategoryGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoryGroupInput) =>
      apiClient<{ data: CategoryGroup }>('/category-groups', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categoryGroups })
    },
  })
}

export function useUpdateCategoryGroup(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCategoryGroupInput) =>
      apiClient<{ data: CategoryGroup }>(`/category-groups/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categoryGroups })
    },
  })
}

export function useDeleteCategoryGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient<null>(`/category-groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categoryGroups })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories })
    },
  })
}

export function useReorderCategoryGroups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: Array<{ id: string; sortOrder: number }>) =>
      apiClient<null>('/category-groups/order', { method: 'PATCH', body: { items } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categoryGroups })
    },
  })
}
