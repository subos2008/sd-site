import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { sendPasswordReset } from '../api'
import { authInput, authLabel, authSubmit } from './AuthShell'

const Schema = z.object({ email: z.string().email() })
type FormData = z.infer<typeof Schema>

export function ForgotPasswordForm() {
  const { t } = useTranslation('auth')
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })
  const [sent, setSent] = useState(false)

  async function onSubmit(values: FormData) {
    try {
      await sendPasswordReset(values.email)
    } catch {
      /* always show success — no account enumeration */
    }
    setSent(true)
  }

  if (sent) return <p className="mt-6 text-bone/80">{t('forgot.sent')}</p>

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('forgot.email')}</span>
        <input className={authInput} type="email" {...register('email')} />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className={`${authSubmit} mt-2 bg-champagne hover:bg-bone`}
      >
        {t('forgot.submit')}
      </button>
    </form>
  )
}
