import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS, type CategoryType } from '@pf/shared'
import type { CategoryWithGroup } from '@pf/shared'
import { apiClient } from '../services/apiClient'

export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: type ? [...QUERY_KEYS.categories, type] : QUERY_KEYS.categories,
    queryFn: () => {
      const params = type ? `?type=${type}` : ''
      return apiClient<{ data: CategoryWithGroup[] }>(`/categories${params}`)
    },
  })
}
