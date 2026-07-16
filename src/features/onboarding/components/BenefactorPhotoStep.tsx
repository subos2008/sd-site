import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useUploadProfilePhoto, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'

export function BenefactorPhotoStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const upload = useUploadProfilePhoto()
  const { data: me } = useMyProfile()
  const [serverError, setServerError] = useState<string | null>(null)

  const photos = me?.ok ? me.profile.photos : []

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
      <h2 className="text-xl">{t('photo.benefactor.title')}</h2>
      <p className="text-sm text-slate-600">{t('photo.benefactor.subtitle')}</p>
      <label className="flex flex-col gap-1">
        <span>{t('photo.upload')}</span>
        <input type="file" accept="image/*" onChange={onFileChange} disabled={upload.isPending} />
      </label>
      {upload.isPending && <p>{t('photo.uploading')}</p>}
      {serverError && <div role="alert" className="text-red-700">{serverError}</div>}
      <div className="flex gap-2">
        {photos.length > 0 && (
          <button
            type="button"
            className="bg-slate-800 text-white py-2 px-3 rounded"
            onClick={() => navigate(nextStepPath('benefactor', 'photo'))}
          >
            {t('photo.continue')}
          </button>
        )}
        <button
          type="button"
          className="underline py-2"
          onClick={() => navigate(nextStepPath('benefactor', 'photo'))}
        >
          {t('photo.skip')}
        </button>
      </div>
    </section>
  )
}
