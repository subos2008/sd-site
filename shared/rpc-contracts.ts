import { z } from 'zod'

// Health check (pre-Plan-02 contract, retained for src/lib health-check test).
export const HealthCheckInput  = z.object({})
export const HealthCheckResult = z.object({
  ok:      z.literal(true),
  service: z.string(),
})
export type HealthCheckResultT = z.infer<typeof HealthCheckResult>

// Generic response envelope. RPCs return ok: true with data, or ok: false with error code.
export const RpcOk     = <T extends z.ZodTypeAny>(data: T) => z.object({ ok: z.literal(true) }).and(data)
export const RpcErr    = z.object({ ok: z.literal(false), error: z.string() })
export const RpcResult = <T extends z.ZodTypeAny>(data: T) => z.union([RpcOk(data), RpcErr])

// Enums (kept in sync with Postgres enums via gen:types compile check).
export const ProfileRole       = z.enum(['benefactor', 'baby'])
export const ProfileGender     = z.enum(['male', 'female', 'nonbinary', 'other'])
export const ProfileLookingFor = z.enum(['male', 'female', 'any'])
export const ProfileStatus     = z.enum(['pending_onboarding', 'active', 'suspended', 'deactivated'])
export const MediaKind         = z.enum(['photo', 'video'])

// ---- Onboarding RPCs ----

export const SetProfileRoleInput  = z.object({ p_role: ProfileRole })
export const SetProfileRoleResult = RpcResult(z.object({}))

export const SetProfileIdentityInput = z.object({
  p_display_name:  z.string().min(1).max(80),
  p_date_of_birth: z.string(), // ISO date YYYY-MM-DD
  p_gender:        ProfileGender,
  p_looking_for:   ProfileLookingFor,
})
export const SetProfileIdentityResult = RpcResult(z.object({}))

export const SetProfileLocationInput = z.object({
  p_display_name: z.string().min(1).max(120),
  p_lat:          z.number().min(-90).max(90),
  p_lng:          z.number().min(-180).max(180),
})
export const SetProfileLocationResult = RpcResult(z.object({}))

export const CompleteOnboardingResult = RpcResult(z.object({}))

// ---- Media RPCs ----

export const PrepareMediaUploadInput = z.object({
  p_kind:             MediaKind,
  p_hash:             z.string().min(16),
  p_size_bytes:       z.number().int().positive(),
  p_width:            z.number().int().positive().nullable(),
  p_height:           z.number().int().positive().nullable(),
  p_duration_seconds: z.number().int().positive().nullable(),
})
// NOTE: Task 10 deviation — `prepare_media_upload` does not return `signed_upload_url`
// because `storage.create_signed_upload_url(...)` is not present in the local Supabase
// storage extension (CLI 2.78.1). The frontend mints the signed upload URL itself via
// `supabase.storage.from('media').createSignedUploadUrl(storage_path)`.
export const PrepareMediaUploadResult = RpcResult(z.object({
  media_item_id: z.string().uuid(),
  storage_path:  z.string(),
  deduped:       z.boolean(),
}))

export const FinalizeMediaUploadInput  = z.object({ p_media_item_id: z.string().uuid() })
export const FinalizeMediaUploadResult = RpcResult(z.object({}))

export const AddToProfilePhotosInput  = z.object({
  p_media_item_id: z.string().uuid(),
  p_ordinal:       z.number().int().min(0),
})
export const AddToProfilePhotosResult = RpcResult(z.object({}))

// ---- View RPCs ----

// NOTE: Task 12 deviation — the view RPCs return storage **paths**, not signed URLs,
// because `storage.create_signed_url(...)` is not present in the local Supabase storage
// extension (CLI 2.78.1). The frontend mints read URLs via
// `supabase.storage.from('media').createSignedUrl(path, 3600)`.
export const ProfileCard = z.object({
  profile_id:         z.string().uuid(),
  display_name:       z.string(),
  age:                z.number().int(),
  city_display_name:  z.string().nullable(),
  distance_miles:     z.number().nullable(),
  primary_photo_path: z.string().nullable(),
  my_like_state:      z.null(),                 // Plan 03 widens this
})

export const ViewSearchInput  = z.object({
  p_filters: z.record(z.string(), z.unknown()).default({}),
  p_cursor:  z.string().nullable().default(null),
})
export const ViewSearchResult = RpcResult(z.object({
  cards:       z.array(ProfileCard),
  next_cursor: z.string().nullable(),
}))

export const ProfilePhoto = z.object({
  ordinal: z.number().int(),
  path:    z.string(),
})

export const ViewProfileInput  = z.object({ p_profile_id: z.string().uuid() })
export const ViewProfileResult = RpcResult(z.object({
  profile: z.object({
    profile_id:        z.string().uuid(),
    display_name:      z.string(),
    age:               z.number().int(),
    city_display_name: z.string().nullable(),
    gender:            ProfileGender.nullable(),
    looking_for:       ProfileLookingFor.nullable(),
    photos:            z.array(ProfilePhoto),
  }),
}))

export const ViewMyProfileResult = RpcResult(z.object({
  profile: z.object({
    profile_id:        z.string().uuid(),
    role:              ProfileRole.nullable(),
    status:            ProfileStatus,
    display_name:      z.string().nullable(),
    age:               z.number().int().nullable(),
    date_of_birth:     z.string().nullable(),
    gender:            ProfileGender.nullable(),
    looking_for:       ProfileLookingFor.nullable(),
    city_display_name: z.string().nullable(),
    token_balance:     z.number().int(),
    photos:            z.array(ProfilePhoto),
  }),
}))

// ---- Geocode Edge Function (HTTP, not RPC, but parsed the same way) ----

export const GeocodeCityInput  = z.object({ place_name: z.string().min(2) })
export const GeocodeCityResult = z.union([
  z.object({ ok: z.literal(true),  display_name: z.string(), lat: z.number(), lng: z.number() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

// Types
export type ProfileCardT       = z.infer<typeof ProfileCard>
export type ViewSearchResultT  = z.infer<typeof ViewSearchResult>
export type ViewProfileResultT = z.infer<typeof ViewProfileResult>
export type ViewMyProfileResultT = z.infer<typeof ViewMyProfileResult>

// ===== Plan 03 additions =====

// Enums for the new columns.
export const BodyType        = z.enum(['slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular'])
export const HairColor       = z.enum(['black', 'brown', 'blonde', 'red', 'grey', 'other'])
export const EyeColor        = z.enum(['brown', 'blue', 'green', 'hazel', 'grey', 'other'])
export const Smoking         = z.enum(['never', 'occasionally', 'regularly', 'prefer_not_to_say'])
export const Drinking        = z.enum(['never', 'socially', 'regularly', 'prefer_not_to_say'])
export const Education       = z.enum(['high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'other'])
export const IncomeBand      = z.enum(['under_50k', '50_100k', '100_250k', '250_500k', '500k_1m', 'over_1m', 'prefer_not_to_say'])
export const NetWorthBand    = z.enum(['under_250k', '250k_1m', '1m_5m', '5m_25m', 'over_25m', 'prefer_not_to_say'])
export const Ethnicity       = z.enum(['white', 'black', 'asian', 'hispanic', 'other'])

// Bio + Details setters
export const SetProfileBioInput = z.object({
  p_tagline: z.string().min(1).max(120).nullable(),
  p_about:   z.string().max(4000).nullable(),
  p_wants:   z.string().max(2000).nullable(),
})
export const SetProfileBioResult = RpcResult(z.object({}))

export const SetProfileDetailsInput = z.object({
  p_height_cm:          z.number().int().min(120).max(240).nullable(),
  p_body_type:          BodyType.nullable(),
  p_hair_color:         HairColor.nullable(),
  p_eye_color:          EyeColor.nullable(),
  p_has_piercings:      z.boolean().nullable(),
  p_has_tattoos:        z.boolean().nullable(),
  p_smoking:            Smoking.nullable(),
  p_drinking:           Drinking.nullable(),
  p_education:          Education.nullable(),
  p_yearly_income_band: IncomeBand.nullable(),
  p_net_worth_band:     NetWorthBand.nullable(),
  p_ethnicity:          Ethnicity.nullable(),
})
export const SetProfileDetailsResult = RpcResult(z.object({}))

// Interests
export const Interest = z.object({
  id:        z.string().uuid(),
  label_key: z.string(),
  category:  z.string(),
  ordinal:   z.number().int().optional(),  // only set by list_interests
})
export const ListInterestsResult = RpcResult(z.object({
  interests: z.array(Interest),
}))
export const SetProfileInterestsInput = z.object({
  p_interest_ids: z.array(z.string().uuid()).max(20),
})
export const SetProfileInterestsResult = RpcResult(z.object({}))

// Photo management
export const ReorderProfilePhotosInput  = z.object({ p_ordered: z.array(z.string().uuid()) })
export const ReorderProfilePhotosResult = RpcResult(z.object({}))
export const RemoveProfilePhotoInput    = z.object({ p_media_item_id: z.string().uuid() })
export const RemoveProfilePhotoResult   = RpcResult(z.object({}))

// Likes
export const LikeProfileInput   = z.object({ p_likee_id: z.string().uuid() })
export const LikeProfileResult  = RpcResult(z.object({}))
export const UnlikeProfileInput = z.object({ p_likee_id: z.string().uuid() })
export const UnlikeProfileResult = RpcResult(z.object({}))

// Updated ProfileCard now includes tagline + my_like_state: boolean (was z.null())
export const ProfileCardV2 = z.object({
  profile_id:         z.string().uuid(),
  display_name:       z.string(),
  age:                z.number().int(),
  city_display_name:  z.string().nullable(),
  distance_miles:     z.number().nullable(),
  primary_photo_path: z.string().nullable(),
  tagline:            z.string().nullable(),
  my_like_state:      z.boolean(),
})

// View likes tab
export const ViewLikesTabResult = RpcResult(z.object({
  liked_me:   z.array(ProfileCardV2),
  favourites: z.array(ProfileCardV2),
}))

// View search v2 — input now accepts filter keys
export const ViewSearchInputV2 = z.object({
  p_filters: z.object({
    min_age:        z.number().int().optional(),
    max_age:        z.number().int().optional(),
    distance_miles: z.number().int().optional(),
    interest_ids:   z.array(z.string().uuid()).optional(),
  }).default({}),
  p_cursor: z.string().nullable().default(null),
})
export const ViewSearchResultV2 = RpcResult(z.object({
  cards:       z.array(ProfileCardV2),
  next_cursor: z.string().nullable(),
}))

// View profile v2 — adds bio, physical, lifestyle, interests, their_like_state
export const ViewProfileResultV2 = RpcResult(z.object({
  profile: z.object({
    profile_id:         z.string().uuid(),
    display_name:       z.string(),
    age:                z.number().int(),
    city_display_name:  z.string().nullable(),
    gender:             ProfileGender.nullable(),
    looking_for:        ProfileLookingFor.nullable(),
    tagline:            z.string().nullable(),
    about:              z.string().nullable(),
    wants:              z.string().nullable(),
    height_cm:          z.number().int().nullable(),
    body_type:          BodyType.nullable(),
    ethnicity:          Ethnicity.nullable(),
    hair_color:         HairColor.nullable(),
    eye_color:          EyeColor.nullable(),
    has_piercings:      z.boolean().nullable(),
    has_tattoos:        z.boolean().nullable(),
    smoking:            Smoking.nullable(),
    drinking:           Drinking.nullable(),
    education:          Education.nullable(),
    yearly_income_band: IncomeBand.nullable(),
    net_worth_band:     NetWorthBand.nullable(),
    photos:             z.array(z.object({ ordinal: z.number().int(), path: z.string() })),
    interests:          z.array(Interest),
    my_like_state:      z.boolean(),
    their_like_state:   z.boolean(),
  }),
}))

// View my-profile v2 (no like_state; includes media_item_id on each photo)
export const ViewMyProfileResultV2 = RpcResult(z.object({
  profile: z.object({
    profile_id:         z.string().uuid(),
    role:               ProfileRole.nullable(),
    status:             ProfileStatus,
    display_name:       z.string().nullable(),
    age:                z.number().int().nullable(),
    date_of_birth:      z.string().nullable(),
    gender:             ProfileGender.nullable(),
    looking_for:        ProfileLookingFor.nullable(),
    city_display_name:  z.string().nullable(),
    tagline:            z.string().nullable(),
    about:              z.string().nullable(),
    wants:              z.string().nullable(),
    height_cm:          z.number().int().nullable(),
    body_type:          BodyType.nullable(),
    ethnicity:          Ethnicity.nullable(),
    hair_color:         HairColor.nullable(),
    eye_color:          EyeColor.nullable(),
    has_piercings:      z.boolean().nullable(),
    has_tattoos:        z.boolean().nullable(),
    smoking:            Smoking.nullable(),
    drinking:           Drinking.nullable(),
    education:          Education.nullable(),
    yearly_income_band: IncomeBand.nullable(),
    net_worth_band:     NetWorthBand.nullable(),
    token_balance:      z.number().int(),
    photos:             z.array(z.object({
      ordinal: z.number().int(),
      path: z.string(),
      media_item_id: z.string().uuid(),
    })),
    interests:          z.array(Interest),
  }),
}))

// Notifications
export const Notification = z.object({
  id:         z.string().uuid(),
  kind:       z.enum(['like', 'placeholder']),
  payload:    z.record(z.string(), z.unknown()),
  created_at: z.string(),  // ISO timestamp
  read_at:    z.string().nullable(),
})
export const ViewNotificationsInput  = z.object({ p_cursor: z.string().nullable().default(null) })
export const ViewNotificationsResult = RpcResult(z.object({
  notifications: z.array(Notification),
  next_cursor:   z.string().nullable(),
}))
export const DismissNotificationInput  = z.object({ p_id: z.string().uuid() })
export const DismissNotificationResult = RpcResult(z.object({}))
export const NotificationsUnreadCountResult = RpcResult(z.object({ count: z.number().int() }))

// Heartbeat
export const TouchLastActiveResult = RpcResult(z.object({}))

// V2 type aliases
export type ProfileCardV2T        = z.infer<typeof ProfileCardV2>
export type ViewSearchResultV2T   = z.infer<typeof ViewSearchResultV2>
export type ViewProfileResultV2T  = z.infer<typeof ViewProfileResultV2>
export type ViewMyProfileResultV2T = z.infer<typeof ViewMyProfileResultV2>
