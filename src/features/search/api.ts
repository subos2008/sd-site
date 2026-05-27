import { callRpc } from '@/lib/rpc'
import { ViewSearchResultV2 } from '@shared/rpc-contracts'

export interface SearchFilters {
  min_age?: number
  max_age?: number
  distance_miles?: number
  interest_ids?: string[]
}

export const viewSearch = (filters: SearchFilters = {}, cursor: string | null = null) =>
  callRpc('view_search', { p_filters: filters, p_cursor: cursor }, ViewSearchResultV2)
