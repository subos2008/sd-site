import { useQuery } from '@tanstack/react-query'
import { viewSearch } from './api'

export function useSearchFirstPage() {
  return useQuery({
    queryKey: ['search', 'first-page'],
    queryFn: () => viewSearch(null),
  })
}
