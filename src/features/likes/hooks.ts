import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { likeProfile, unlikeProfile, viewLikesTab } from './api'

export function useLikesTab() {
  return useQuery({
    queryKey: ['likes-tab'],
    queryFn: viewLikesTab,
  })
}

function invalidateAfterLikeChange(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['likes-tab'] })
  qc.invalidateQueries({ queryKey: ['search'] })
  qc.invalidateQueries({ queryKey: ['profile'] })
}

export function useLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: likeProfile,
    onSuccess: () => invalidateAfterLikeChange(qc),
  })
}

export function useUnlike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlikeProfile,
    onSuccess: () => invalidateAfterLikeChange(qc),
  })
}
