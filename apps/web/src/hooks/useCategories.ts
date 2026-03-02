import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS, type CategoryType } from '@pf/shared'
import type { CategoryWithGroup, CreateCategoryInput, UpdateCategoryInput } from '@pf/shared'
import { apiClient } from '../services/apiClient'

export function useCategories(type?: CategoryType, showHidden?: boolean) {
  return useQuery({
    queryKey: [...QUERY_KEYS.categories, { type, showHidden }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (showHidden) params.set('showHidden', 'true')
      const qs = params.toString()
      return apiClient<{ data: CategoryWithGroup[] }>(`/categories${qs ? `?${qs}` : ''}`)
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      apiClient<{ data: CategoryWithGroup }>('/categories', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    },
  })
}

export function useUpdateCategory(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCategoryInput) =>
      apiClient<{ data: CategoryWithGroup }>(`/categories/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    },
  })
}

export function useToggleCategoryVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ data: CategoryWithGroup }>(`/categories/${id}/visibility`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, replacementCategoryId }: { id: string; replacementCategoryId?: string }) => {
      const qs = replacementCategoryId ? `?replacementCategoryId=${replacementCategoryId}` : ''
      return apiClient<null>(`/categories/${id}${qs}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    },
  })
}
