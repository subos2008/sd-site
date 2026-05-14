import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { sendPasswordReset } from '../api'

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

  if (sent) return <p className="p-4">{t('forgot.sent')}</p>

  return (
    <form className="flex flex-col gap-3 p-4 max-w-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('forgot.email')}</span>
        <input className="border p-2 rounded" type="email" {...register('email')} />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-slate-800 text-white py-2 rounded"
      >
        {t('forgot.submit')}
      </button>
    </form>
  )
}
