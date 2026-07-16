import { useMyProfile } from '../hooks'
import { BabyPhotoStep } from './BabyPhotoStep'
import { BenefactorPhotoStep } from './BenefactorPhotoStep'

export function PhotoStep() {
  const { data: me, isLoading } = useMyProfile()
  if (isLoading) return null
  const role = me?.ok ? me.profile.role : null
  return role === 'baby' ? <BabyPhotoStep /> : <BenefactorPhotoStep />
}
