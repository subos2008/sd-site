import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { isAdult } from '@/lib/dob'
import { useSetIdentity } from '../hooks'

type FormData = {
  display_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'nonbinary' | 'other'
  looking_for: 'male' | 'female' | 'any'
}

export function IdentityStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setIdentity = useSetIdentity()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      display_name: '',
      date_of_birth: '',
      gender: 'male',
      looking_for: 'any',
    },
  })

  const dobValue = watch('date_of_birth')
  const dobDate = dobValue ? new Date(dobValue) : null
  const dobValid = dobDate && !Number.isNaN(dobDate.getTime())
  const adult = dobValid ? isAdult(dobDate) : false
  const showUnder18 = dobValid && !adult

  async function onSubmit(values: FormData) {
    setServerError(null)
    if (!isAdult(new Date(values.date_of_birth))) return
    try {
      const res = await setIdentity.mutateAsync(values)
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      navigate('/onboarding/location')
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  return (
    <form
      className="flex flex-col gap-3 p-4 max-w-sm"
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className="text-xl">{t('identity.title')}</h2>
      <label className="flex flex-col gap-1">
        <span>{t('identity.displayName')}</span>
        <input
          className="border p-2 rounded"
          type="text"
          {...register('display_name', { required: true, maxLength: 80 })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('identity.dob')}</span>
        <input
          className="border p-2 rounded"
          type="date"
          {...register('date_of_birth', { required: true })}
        />
        {showUnder18 && (
          <span className="text-sm text-red-700">{t('identity.dobUnder18')}</span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('identity.gender')}</span>
        <select className="border p-2 rounded" {...register('gender')}>
          <option value="male">{t('identity.gender.male')}</option>
          <option value="female">{t('identity.gender.female')}</option>
          <option value="nonbinary">{t('identity.gender.nonbinary')}</option>
          <option value="other">{t('identity.gender.other')}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('identity.lookingFor')}</span>
        <select className="border p-2 rounded" {...register('looking_for')}>
          <option value="male">{t('identity.lookingFor.male')}</option>
          <option value="female">{t('identity.lookingFor.female')}</option>
          <option value="any">{t('identity.lookingFor.any')}</option>
        </select>
      </label>
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting || !dobValid || !adult}
        className="bg-slate-800 text-white py-2 rounded disabled:opacity-50"
      >
        {t('identity.continue')}
      </button>
    </form>
  )
}
