import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  viewMyProfile,
  setProfileRole,
  setProfileIdentity,
  setProfileLocation,
  prepareMediaUpload,
  finalizeMediaUpload,
  addToProfilePhotos,
  completeOnboarding,
} from './api'
import { supabase } from '@/lib/supabase'

export function useMyProfile() {
  return useQuery({ queryKey: ['my-profile'], queryFn: viewMyProfile })
}

export function useSetRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useSetIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      display_name: string
      date_of_birth: string
      gender: 'male' | 'female' | 'nonbinary' | 'other'
      looking_for: 'male' | 'female' | 'any'
    }) =>
      setProfileIdentity(args.display_name, args.date_of_birth, args.gender, args.looking_for),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useSetLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { display_name: string; lat: number; lng: number }) =>
      setProfileLocation(args.display_name, args.lat, args.lng),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useUploadProfilePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { sha256Hex } = await import('@/lib/hash')
      const hash = await sha256Hex(file)
      const prepared = await prepareMediaUpload({
        kind: 'photo',
        hash,
        size_bytes: file.size,
        width: null,
        height: null,
        duration_seconds: null,
      })
      if (!prepared.ok) throw new Error(prepared.error)

      // Task 10/12 deviation: server doesn't mint signed_upload_url; do it client-side.
      const { data: signedData, error: signedError } = await supabase.storage
        .from('media')
        .createSignedUploadUrl(prepared.storage_path)
      if (signedError) throw signedError

      const putRes = await fetch(signedData.signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type },
      })
      if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

      const fin = await finalizeMediaUpload(prepared.media_item_id)
      if (!fin.ok) throw new Error(fin.error)
      const add = await addToProfilePhotos(prepared.media_item_id, 0)
      if (!add.ok) throw new Error(add.error)
      return prepared.media_item_id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
