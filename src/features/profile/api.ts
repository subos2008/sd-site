import { callRpc } from '@/lib/rpc'
import {
  ViewProfileResultV2,
  ViewMyProfileResultV2,
  SetProfileBioResult,
  SetProfileDetailsResult,
  ReorderProfilePhotosResult,
  RemoveProfilePhotoResult,
} from '@shared/rpc-contracts'

export const viewProfile = (id: string) =>
  callRpc('view_profile', { p_profile_id: id }, ViewProfileResultV2)

export const viewMyProfile = () =>
  callRpc('view_my_profile', {}, ViewMyProfileResultV2)

export const setProfileBio = (tagline: string | null, about: string | null, wants: string | null) =>
  callRpc(
    'set_profile_bio',
    { p_tagline: tagline, p_about: about, p_wants: wants },
    SetProfileBioResult,
  )

export const setProfileDetails = (args: {
  height_cm: number | null
  body_type: string | null
  hair_color: string | null
  eye_color: string | null
  has_piercings: boolean | null
  has_tattoos: boolean | null
  smoking: string | null
  drinking: string | null
  education: string | null
  yearly_income_band: string | null
  net_worth_band: string | null
}) =>
  callRpc(
    'set_profile_details',
    {
      p_height_cm: args.height_cm,
      p_body_type: args.body_type,
      p_hair_color: args.hair_color,
      p_eye_color: args.eye_color,
      p_has_piercings: args.has_piercings,
      p_has_tattoos: args.has_tattoos,
      p_smoking: args.smoking,
      p_drinking: args.drinking,
      p_education: args.education,
      p_yearly_income_band: args.yearly_income_band,
      p_net_worth_band: args.net_worth_band,
    },
    SetProfileDetailsResult,
  )

export const reorderProfilePhotos = (orderedMediaItemIds: string[]) =>
  callRpc('reorder_profile_photos', { p_ordered: orderedMediaItemIds }, ReorderProfilePhotosResult)

export const removeProfilePhoto = (mediaItemId: string) =>
  callRpc('remove_profile_photo', { p_media_item_id: mediaItemId }, RemoveProfilePhotoResult)
