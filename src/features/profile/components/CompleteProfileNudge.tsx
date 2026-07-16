import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const KEY = 'sd.nudge.completeProfile.dismissed'

interface Props {
  profileRole: 'benefactor' | 'baby' | null
  hasDetails: boolean
  hasInterests: boolean
}

export function CompleteProfileNudge({ profileRole, hasDetails, hasInterests }: Props) {
  const { t } = useTranslation('profile')
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === '1')

  if (profileRole !== 'benefactor') return null
  if (hasDetails && hasInterests) return null
  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="border rounded-lg p-4 bg-amber-50 flex flex-col gap-2">
      <h2 className="font-semibold">{t('nudge.completeProfile.title')}</h2>
      <p className="text-sm text-slate-700">{t('nudge.completeProfile.body')}</p>
      <button type="button" className="self-start underline text-sm" onClick={dismiss}>
        {t('nudge.completeProfile.dismiss')}
      </button>
    </div>
  )
}
