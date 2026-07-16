import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { APP_CONFIG } from '@shared/app-config'
import { useUploadProfilePhoto, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'

export function BabyPhotoStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const upload = useUploadProfilePhoto()
  const { data: me } = useMyProfile()
  const [serverError, setServerError] = useState<string | null>(null)

  const photos = me?.ok ? me.profile.photos : []
  const min = APP_CONFIG.onboarding.babyMinPhotos
  const met = photos.length >= min
  const slots = Math.max(min, photos.length)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    setServerError(null)
    try {
      await upload.mutateAsync({ file, ordinal: photos.length })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('photo.baby.title')}</h2>
      <p className="text-sm text-slate-600">{t('photo.baby.subtitle')}</p>
      <p className="text-sm">{t('photo.baby.progress', { count: photos.length, min })}</p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < photos.length
          return (
            <label
              key={i}
              className="relative aspect-square bg-slate-200 rounded flex items-center justify-center cursor-pointer text-2xl text-slate-500"
            >
              {filled ? '✓' : '+'}
              <span className="sr-only">{t('photo.baby.addSlot')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                disabled={upload.isPending}
              />
            </label>
          )
        })}
      </div>
      {upload.isPending && <p>{t('photo.uploading')}</p>}
      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}
      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded disabled:opacity-50"
        disabled={!met}
        onClick={() => navigate(nextStepPath('baby', 'photo'))}
      >
        {t('photo.baby.continue')}
      </button>
    </section>
  )
}
