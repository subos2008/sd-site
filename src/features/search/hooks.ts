import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { viewSearch, type SearchFilters } from './api'

export function useSearchFirstPage(filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ['search', 'first-page', filters],
    queryFn: () => viewSearch(filters, null),
  })
}

export interface ParsedFilters {
  min_age?: number
  max_age?: number
  distance_miles?: number
  interest_ids?: string[]
}

function parseInt0(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function useSearchFilters(): [ParsedFilters, (next: ParsedFilters) => void] {
  const [params, setParams] = useSearchParams()
  const filters: ParsedFilters = {
    min_age: parseInt0(params.get('min_age')),
    max_age: parseInt0(params.get('max_age')),
    distance_miles: parseInt0(params.get('distance_miles')),
    interest_ids: params.get('interest_ids')?.split(',').filter(Boolean) ?? undefined,
  }

  const setFilters = (next: ParsedFilters) => {
    const out = new URLSearchParams()
    if (next.min_age != null) out.set('min_age', String(next.min_age))
    if (next.max_age != null) out.set('max_age', String(next.max_age))
    if (next.distance_miles != null) out.set('distance_miles', String(next.distance_miles))
    if (next.interest_ids && next.interest_ids.length > 0)
      out.set('interest_ids', next.interest_ids.join(','))
    setParams(out, { replace: true })
  }

  return [filters, setFilters]
}
