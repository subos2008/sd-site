import { callRpc } from '@/lib/rpc'
import { ListInterestsResult, SetProfileInterestsResult } from '@shared/rpc-contracts'

export const listInterests = () =>
  callRpc('list_interests', {}, ListInterestsResult)

export const setProfileInterests = (ids: string[]) =>
  callRpc('set_profile_interests', { p_interest_ids: ids }, SetProfileInterestsResult)
