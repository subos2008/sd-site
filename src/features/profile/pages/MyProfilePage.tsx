import { useTranslation } from 'react-i18next'
import { useMyProfile } from '../hooks'
import { BioSection } from '../components/BioSection'
import { CompleteProfileNudge } from '../components/CompleteProfileNudge'
import { DetailsSection } from '../components/DetailsSection'
import { InterestsSection } from '../components/InterestsSection'
import { PhotoGallery } from '../components/PhotoGallery'
import { PlaceSection } from '../components/PlaceSection'

export function MyProfilePage() {
  const { t } = useTranslation('profile')
  const { data, isLoading, error } = useMyProfile()

  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('notFound')}</p>

  const p = data.profile
  const hasDetails = p.height_cm != null || p.body_type != null || p.education != null
  const hasInterests = p.interests.length > 0
  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">
          {p.display_name ?? ''}
          {p.age != null ? `, ${p.age}` : ''}
        </h1>
        <p className="text-slate-600">{p.city_display_name}</p>
        <p className="text-sm text-slate-500">
          {p.gender} · looking for {p.looking_for}
        </p>
      </header>
      <CompleteProfileNudge
        profileRole={p.role}
        hasDetails={hasDetails}
        hasInterests={hasInterests}
      />
      <PlaceSection city={p.city_display_name} />
      <dl className="text-sm grid grid-cols-2 gap-2">
        <dt className="text-slate-500">{t('yourStatus')}</dt>
        <dd>{p.status}</dd>
        <dt className="text-slate-500">{t('yourRole')}</dt>
        <dd>{p.role ?? ''}</dd>
        <dt className="text-slate-500">{t('yourTokens')}</dt>
        <dd>{p.token_balance}</dd>
      </dl>
      <PhotoGallery photos={p.photos} />
      <BioSection tagline={p.tagline} about={p.about} wants={p.wants} />
      <DetailsSection
        height_cm={p.height_cm}
        body_type={p.body_type}
        ethnicity={p.ethnicity}
        hair_color={p.hair_color}
        eye_color={p.eye_color}
        has_piercings={p.has_piercings}
        has_tattoos={p.has_tattoos}
        smoking={p.smoking}
        drinking={p.drinking}
        education={p.education}
        yearly_income_band={p.yearly_income_band}
        net_worth_band={p.net_worth_band}
      />
      <InterestsSection interests={p.interests} />
    </main>
  )
}
