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
