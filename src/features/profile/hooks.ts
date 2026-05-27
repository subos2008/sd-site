import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  viewProfile,
  viewMyProfile,
  setProfileBio,
  setProfileDetails,
  reorderProfilePhotos,
  removeProfilePhoto,
} from './api'

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

export function useSetBio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { tagline: string | null; about: string | null; wants: string | null }) =>
      setProfileBio(args.tagline, args.about, args.wants),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useSetDetails() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileDetails,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useReorderPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reorderProfilePhotos,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useRemovePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeProfilePhoto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
