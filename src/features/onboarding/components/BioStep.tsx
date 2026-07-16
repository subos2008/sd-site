import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { APP_CONFIG } from '@shared/app-config'
import { useMyProfile } from '../hooks'
import { useSetBio } from '@/features/profile/hooks'
import { nextStepPath } from '../steps'

export function BioStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setBio = useSetBio()
  const { data: me } = useMyProfile()
  const min = APP_CONFIG.onboarding.babyMinBioChars

  const [tagline, setTagline] = useState(me?.ok ? (me.profile.tagline ?? '') : '')
  const [about, setAbout] = useState(me?.ok ? (me.profile.about ?? '') : '')
  const [wants, setWants] = useState(me?.ok ? (me.profile.wants ?? '') : '')
  const [serverError, setServerError] = useState<string | null>(null)

  const valid =
    tagline.trim().length >= 1 &&
    about.trim().length >= min &&
    wants.trim().length >= min

  async function onContinue() {
    setServerError(null)
    try {
      const res = await setBio.mutateAsync({
        tagline: tagline.trim(),
        about: about.trim(),
        wants: wants.trim(),
      })
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      navigate(nextStepPath('baby', 'bio'))
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('bio.title')}</h2>
      <p className="text-sm text-slate-600">{t('bio.subtitle')}</p>

      <label className="flex flex-col gap-1">
        <span>{t('bio.tagline.label')}</span>
        <input
          className="border rounded p-2"
          maxLength={120}
          placeholder={t('bio.tagline.placeholder')}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>{t('bio.about.label')}</span>
        <textarea
          className="border rounded p-2 min-h-[6rem]"
          maxLength={4000}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />
        <span className="text-xs text-slate-500">{t('bio.minChars', { min })}</span>
      </label>

      <label className="flex flex-col gap-1">
        <span>{t('bio.wants.label')}</span>
        <textarea
          className="border rounded p-2 min-h-[4rem]"
          maxLength={2000}
          value={wants}
          onChange={(e) => setWants(e.target.value)}
        />
        <span className="text-xs text-slate-500">{t('bio.minChars', { min })}</span>
      </label>

      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}

      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded disabled:opacity-50"
        disabled={!valid || setBio.isPending}
        onClick={onContinue}
      >
        {t('bio.continue')}
      </button>
    </section>
  )
}
