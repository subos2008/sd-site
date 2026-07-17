import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { isAdult } from '@/lib/dob'
import { useSession } from '@/lib/auth-context'
import { identityForRole } from '@/features/auth/roleDerivation'
import { useSetIdentity, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'

type FormData = {
  display_name: string
  date_of_birth: string
}

export function IdentityStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setIdentity = useSetIdentity()
  const { data: me } = useMyProfile()
  const role = me?.ok ? me.profile.role : null
  const { session } = useSession()
  const metadataUsername =
    typeof session?.user?.user_metadata?.username === 'string'
      ? (session.user.user_metadata.username as string)
      : ''
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      display_name: metadataUsername,
      date_of_birth: '',
    },
  })

  const dobValue = useWatch({ control, name: 'date_of_birth' })
  const dobDate = dobValue ? new Date(dobValue) : null
  const dobValid = dobDate && !Number.isNaN(dobDate.getTime())
  const adult = dobValid ? isAdult(dobDate) : false
  const showUnder18 = dobValid && !adult

  async function onSubmit(values: FormData) {
    setServerError(null)
    if (!isAdult(new Date(values.date_of_birth))) return
    try {
      const res = await setIdentity.mutateAsync({
        display_name: values.display_name,
        date_of_birth: values.date_of_birth,
        ...identityForRole(role ?? 'benefactor'),
      })
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      navigate(nextStepPath(role ?? 'benefactor', 'identity'))
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
        <span>{t('identity.username')}</span>
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
