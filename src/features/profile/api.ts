import { callRpc } from '@/lib/rpc'
import { ViewProfileResult, ViewMyProfileResult } from '@shared/rpc-contracts'

export const viewProfile = (id: string) =>
  callRpc('view_profile', { p_profile_id: id }, ViewProfileResult)

export const viewMyProfile = () => callRpc('view_my_profile', {}, ViewMyProfileResult)
