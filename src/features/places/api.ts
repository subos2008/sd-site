import { callRpc } from '@/lib/rpc'
import { SearchPlacesResult, SetProfileLocationResult } from '@shared/rpc-contracts'

export const searchPlaces = (query: string) =>
  callRpc('search_places', { p_query: query }, SearchPlacesResult)

export const setProfileLocation = (placeId: number) =>
  callRpc('set_profile_location', { p_place_id: placeId }, SetProfileLocationResult)
