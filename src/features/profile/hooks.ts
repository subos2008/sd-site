import { useQuery } from '@tanstack/react-query'
import { viewProfile, viewMyProfile } from './api'

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: () => viewProfile(id),
    enabled: !!id,
  })
}

export function useMyProfile() {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: viewMyProfile,
  })
}
