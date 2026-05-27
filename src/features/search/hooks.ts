import { useQuery } from '@tanstack/react-query'
import { viewSearch, type SearchFilters } from './api'

export function useSearchFirstPage(filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ['search', 'first-page', filters],
    queryFn: () => viewSearch(filters, null),
  })
}
