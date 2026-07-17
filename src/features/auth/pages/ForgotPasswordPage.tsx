import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ForgotPasswordForm } from '../components/ForgotPasswordForm'
import { AuthShell } from '../components/AuthShell'

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold">{t('forgot.title')}</h1>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-bone/70">
        <Link to="/login" className="underline hover:text-bone">
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </AuthShell>
  )
}
