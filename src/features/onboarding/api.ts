import { callRpc } from '@/lib/rpc'
import {
  SetProfileRoleResult,
  SetProfileIdentityResult,
  SetProfileLocationResult,
  CompleteOnboardingResult,
  PrepareMediaUploadResult,
  FinalizeMediaUploadResult,
  AddToProfilePhotosResult,
  ViewMyProfileResult,
  ProfileRole,
  ProfileGender,
  ProfileLookingFor,
} from '@shared/rpc-contracts'
import type { z } from 'zod'

export const setProfileRole = (role: z.infer<typeof ProfileRole>) =>
  callRpc('set_profile_role', { p_role: role }, SetProfileRoleResult)

export const setProfileIdentity = (
  display_name: string,
  date_of_birth: string,
  gender: z.infer<typeof ProfileGender>,
  looking_for: z.infer<typeof ProfileLookingFor>,
) =>
  callRpc(
    'set_profile_identity',
    {
      p_display_name: display_name,
      p_date_of_birth: date_of_birth,
      p_gender: gender,
      p_looking_for: looking_for,
    },
    SetProfileIdentityResult,
  )

export const setProfileLocation = (display_name: string, lat: number, lng: number) =>
  callRpc(
    'set_profile_location',
    { p_display_name: display_name, p_lat: lat, p_lng: lng },
    SetProfileLocationResult,
  )

export const prepareMediaUpload = (args: {
  kind: 'photo' | 'video'
  hash: string
  size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
}) =>
  callRpc(
    'prepare_media_upload',
    {
      p_kind: args.kind,
      p_hash: args.hash,
      p_size_bytes: args.size_bytes,
      p_width: args.width,
      p_height: args.height,
      p_duration_seconds: args.duration_seconds,
    },
    PrepareMediaUploadResult,
  )

export const finalizeMediaUpload = (id: string) =>
  callRpc('finalize_media_upload', { p_media_item_id: id }, FinalizeMediaUploadResult)

export const addToProfilePhotos = (id: string, ordinal: number) =>
  callRpc(
    'add_to_profile_photos',
    { p_media_item_id: id, p_ordinal: ordinal },
    AddToProfilePhotosResult,
  )

export const completeOnboarding = () =>
  callRpc('complete_onboarding', {}, CompleteOnboardingResult)

export const viewMyProfile = () => callRpc('view_my_profile', {}, ViewMyProfileResult)
