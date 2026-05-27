import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useUploadProfilePhoto } from '../hooks'

export function PhotoStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const upload = useUploadProfilePhoto()
  const [uploaded, setUploaded] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setServerError(null)
    setUploaded(false)
    try {
      await upload.mutateAsync(file)
      setUploaded(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('photo.title')}</h2>
      <label className="flex flex-col gap-1">
        <span>{t('photo.upload')}</span>
        <input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          disabled={upload.isPending}
        />
      </label>
      {upload.isPending && <p>{t('photo.uploading')}</p>}
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}
      {uploaded && (
        <button
          type="button"
          className="bg-slate-800 text-white py-2 rounded"
          onClick={() => navigate('/onboarding/details')}
        >
          {t('photo.continue')}
        </button>
      )}
    </section>
  )
}
