import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '../api'
import { authError, authInput, authLabel, authSubmit } from './AuthShell'

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
type FormData = z.infer<typeof Schema>

export function SignupForm({
  onSuccess,
  roleHint,
}: {
  onSuccess?: () => void
  roleHint?: 'benefactor' | 'baby'
}) {
  const { t } = useTranslation('auth')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(values: FormData) {
    setServerError(null)
    try {
      await signUp(values.email, values.password, roleHint)
      setDone(true)
      onSuccess?.()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  if (done) return <p className="mt-6 text-bone/80">{t('signup.checkEmail')}</p>

  const submitAccent = roleHint === 'baby' ? 'bg-rose hover:bg-bone' : 'bg-champagne hover:bg-bone'

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('signup.email')}</span>
        <input
          className={authInput}
          type="email"
          placeholder={t('signup.emailPlaceholder')}
          {...register('email')}
        />
        {errors.email && <span className={authError}>{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('signup.password')}</span>
        <input
          className={authInput}
          type="password"
          placeholder={t('signup.passwordPlaceholder')}
          {...register('password')}
        />
        {errors.password && <span className={authError}>{errors.password.message}</span>}
      </label>
      {serverError && (
        <div role="alert" className={authError}>
          {serverError}
        </div>
      )}
      <button type="submit" disabled={isSubmitting} className={`${authSubmit} ${submitAccent} mt-2`}>
        {t('signup.submit')}
      </button>
    </form>
  )
}
