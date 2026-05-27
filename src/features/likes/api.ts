import { callRpc } from '@/lib/rpc'
import { LikeProfileResult, UnlikeProfileResult, ViewLikesTabResult } from '@shared/rpc-contracts'

export const likeProfile   = (id: string) => callRpc('like_profile',   { p_likee_id: id }, LikeProfileResult)
export const unlikeProfile = (id: string) => callRpc('unlike_profile', { p_likee_id: id }, UnlikeProfileResult)
export const viewLikesTab  = ()           => callRpc('view_likes_tab', {}, ViewLikesTabResult)
