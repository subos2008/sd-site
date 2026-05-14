import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCompleteOnboarding } from '../hooks'

export function OnboardingCompletePage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const complete = useCompleteOnboarding()
  const [failed, setFailed] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const res = await complete.mutateAsync()
        if (res.ok) {
          navigate('/search')
        } else {
          setFailed(true)
        }
      } catch {
        setFailed(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      {!failed && <p>{t('complete.title')}</p>}
      {failed && (
        <div role="alert" className="text-red-700">
          {t('complete.failure')}
        </div>
      )}
    </section>
  )
}
