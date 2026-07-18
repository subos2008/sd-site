import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/auth-context'
import { BodyType, Ethnicity } from '@shared/rpc-contracts'
import { setProfileDetails } from '@/features/profile/api'
import { setProfileLocation } from '@/features/places/api'
import { useMyProfile } from './hooks'

/**
 * On first authenticated entry after the single-page signup, commit the
 * profile fields that rode in auth metadata:
 * - body_type/ethnicity via set_profile_details (sensitive fields)
 * - place_id via set_profile_location (the signup form requires a picked
 *   place, so every new signup carries one; the wizard has no location step)
 * Role rides too but is committed by RoleStep's existing auto-commit;
 * identity needs DOB and stays in the wizard.
 *
 * Both commits are run-once, best-effort, and gated on the profile not
 * already having the fields set (not just a per-mount ref): if
 * OnboardingLayout remounts (e.g. a page refresh mid-onboarding), a bare
 * ref would re-fire and could clobber values the user changed in the
 * meantime. On failure the ref resets so a remount retries;
 * complete_onboarding remains the backstop (location_missing) if the
 * location commit never lands.
 */
export function useSignupBootstrap(): void {
  const { session } = useSession()
  const { data: me } = useMyProfile()
  const detailsDone = useRef(false)
  const locationDone = useRef(false)

  useEffect(() => {
    if (detailsDone.current) return
    if (!me?.ok) return
    if (me.profile.body_type != null || me.profile.ethnicity != null) return
    const meta = session?.user?.user_metadata ?? {}
    const body_type = BodyType.safeParse(meta.body_type)
    const ethnicity = Ethnicity.safeParse(meta.ethnicity)
    if (!body_type.success && !ethnicity.success) return
    detailsDone.current = true
    void setProfileDetails({
      height_cm: null,
      body_type: body_type.success ? body_type.data : null,
      hair_color: null,
      eye_color: null,
      has_piercings: null,
      has_tattoos: null,
      smoking: null,
      drinking: null,
      education: null,
      yearly_income_band: null,
      net_worth_band: null,
      ethnicity: ethnicity.success ? ethnicity.data : null,
    }).catch(() => {
      // best-effort; details step will collect on failure
      detailsDone.current = false
    })
  }, [session, me])

  useEffect(() => {
    if (locationDone.current) return
    if (!me?.ok) return
    if (me.profile.city_display_name != null) return
    const placeId = session?.user?.user_metadata?.place_id
    if (typeof placeId !== 'number') return
    locationDone.current = true
    void setProfileLocation(placeId).then(
      (res) => {
        // best-effort; complete_onboarding backstops with location_missing
        if (!res.ok) locationDone.current = false
      },
      () => {
        // best-effort; complete_onboarding backstops with location_missing
        locationDone.current = false
      },
    )
  }, [session, me])
}
