import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  setProfileRole,
  setProfileIdentity,
  setProfileLocation,
  prepareMediaUpload,
  finalizeMediaUpload,
  addToProfilePhotos,
  completeOnboarding,
} from './api'
import { supabase } from '@/lib/supabase'

// Re-export from the canonical location to avoid duplicate query definitions.
export { useMyProfile } from '@/features/profile/hooks'
export { useSetDetails } from '@/features/profile/hooks'
export { useSetProfileInterests as useSetInterests } from '@/features/interests/hooks'
export { useInterests } from '@/features/interests/hooks'

export function useSetRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setProfileRole,
    meta: { suppressGlobalError: true },
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
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useSetLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { display_name: string; lat: number; lng: number }) =>
      setProfileLocation(args.display_name, args.lat, args.lng),
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: completeOnboarding,
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}

export function useUploadProfilePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: File | { file: File; ordinal?: number }) => {
      const file = args instanceof File ? args : args.file
      const ordinal = args instanceof File ? 0 : (args.ordinal ?? 0)
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
      const add = await addToProfilePhotos(prepared.media_item_id, ordinal)
      if (!add.ok) throw new Error(add.error)
      return prepared.media_item_id
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-profile'] }),
  })
}
