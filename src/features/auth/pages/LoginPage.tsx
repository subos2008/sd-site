import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '../components/LoginForm'
import { AuthShell } from '../components/AuthShell'

export function LoginPage() {
  const { t } = useTranslation('auth')
  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold">{t('login.title')}</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-bone/70">
        <Link to="/forgot-password" className="underline hover:text-bone">
          {t('login.forgot')}
        </Link>
      </p>
      <p className="mt-2 text-sm text-bone/70">
        <Link to="/signup" className="underline hover:text-bone">
          {t('login.needAccount')}
        </Link>
      </p>
    </AuthShell>
  )
}
