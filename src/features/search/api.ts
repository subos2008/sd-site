import { callRpc } from '@/lib/rpc'
import { ViewSearchResult } from '@shared/rpc-contracts'

export const viewSearch = (cursor: string | null = null) =>
  callRpc('view_search', { p_filters: {}, p_cursor: cursor }, ViewSearchResult)
