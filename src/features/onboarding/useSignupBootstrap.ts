import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/auth-context'
import { BodyType, Ethnicity } from '@shared/rpc-contracts'
import { setProfileDetails } from '@/features/profile/api'
import { useMyProfile } from './hooks'

/**
 * On first authenticated entry after the single-page signup, commit the
 * sensitive profile fields that rode in auth metadata (body_type, ethnicity)
 * via set_profile_details. Role rides too but is committed by RoleStep's
 * existing auto-commit; identity/location need DOB/geocode and stay in the
 * wizard. Run-once, best-effort — a failure just leaves the details step to
 * collect them (pre-selected).
 *
 * Gated on the profile not already having body_type/ethnicity set, not just
 * a per-mount ref: if OnboardingLayout remounts (e.g. a page refresh
 * mid-onboarding), a bare ref would re-fire the commit and, because
 * setProfileDetails sends every other detail field as null, would null out
 * any details the user had already entered in the meantime.
 */
export function useSignupBootstrap(): void {
  const { session } = useSession()
  const { data: me } = useMyProfile()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    if (!me?.ok) return
    if (me.profile.body_type != null || me.profile.ethnicity != null) return
    const meta = session?.user?.user_metadata ?? {}
    const body_type = BodyType.safeParse(meta.body_type)
    const ethnicity = Ethnicity.safeParse(meta.ethnicity)
    if (!body_type.success && !ethnicity.success) return
    done.current = true
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
      done.current = false
    })
  }, [session, me])
}
