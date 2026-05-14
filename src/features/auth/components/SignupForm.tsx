import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '../api'

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
type FormData = z.infer<typeof Schema>

export function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
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
      await signUp(values.email, values.password)
      setDone(true)
      onSuccess?.()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  if (done) return <p className="p-4">{t('signup.checkEmail')}</p>

  return (
    <form className="flex flex-col gap-3 p-4 max-w-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('signup.email')}</span>
        <input className="border p-2 rounded" type="email" {...register('email')} />
        {errors.email && <span className="text-sm text-red-700">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('signup.password')}</span>
        <input className="border p-2 rounded" type="password" {...register('password')} />
        {errors.password && (
          <span className="text-sm text-red-700">{errors.password.message}</span>
        )}
      </label>
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-slate-800 text-white py-2 rounded"
      >
        {t('signup.submit')}
      </button>
    </form>
  )
}
