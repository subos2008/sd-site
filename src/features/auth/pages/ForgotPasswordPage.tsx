import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ForgotPasswordForm } from '../components/ForgotPasswordForm'

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  return (
    <main className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-semibold px-4">{t('forgot.title')}</h1>
      <ForgotPasswordForm />
      <p className="px-4 mt-2">
        <Link to="/login" className="underline">
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </main>
  )
}
