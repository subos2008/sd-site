import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { logIn } from '../api'
import { authError, authInput, authLabel, authSubmit } from './AuthShell'

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) })
type FormData = z.infer<typeof Schema>

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation('auth')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })
  const [serverError, setServerError] = useState<string | null>(null)

  async function onSubmit(values: FormData) {
    setServerError(null)
    try {
      await logIn(values.email, values.password)
      onSuccess?.()
    } catch {
      setServerError(t('login.invalid'))
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('login.email')}</span>
        <input className={authInput} type="email" {...register('email')} />
        {errors.email && <span className={authError}>{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('login.password')}</span>
        <input className={authInput} type="password" {...register('password')} />
      </label>
      {serverError && (
        <div role="alert" className={authError}>
          {serverError}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`${authSubmit} mt-2 bg-champagne hover:bg-bone`}
      >
        {t('login.submit')}
      </button>
    </form>
  )
}
