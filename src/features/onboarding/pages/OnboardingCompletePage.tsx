import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCompleteOnboarding } from '../hooks'

const PHOTO_ERRORS = new Set(['photos_required'])
const BIO_ERRORS = new Set(['tagline_required', 'about_required', 'wants_required'])

export function OnboardingCompletePage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const complete = useCompleteOnboarding()
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const res = await complete.mutateAsync()
        if (res.ok) navigate('/search')
        else setErrorCode(res.error)
      } catch {
        setErrorCode('generic')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!errorCode) {
    return (
      <section className="flex flex-col gap-3 p-4 max-w-sm">
        <p>{t('complete.title')}</p>
      </section>
    )
  }

  const messageKey = `complete.error.${errorCode}`
  const message = t(messageKey, { defaultValue: t('complete.error.generic') })

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <div role="alert" className="text-red-700">{message}</div>
      {PHOTO_ERRORS.has(errorCode) && (
        <button
          type="button"
          className="bg-slate-800 text-white py-2 rounded"
          onClick={() => navigate('/onboarding/photo')}
        >
          {t('complete.fixPhotos')}
        </button>
      )}
      {BIO_ERRORS.has(errorCode) && (
        <button
          type="button"
          className="bg-slate-800 text-white py-2 rounded"
          onClick={() => navigate('/onboarding/bio')}
        >
          {t('complete.fixBio')}
        </button>
      )}
    </section>
  )
}
