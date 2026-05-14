import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '../components/LoginForm'

export function LoginPage() {
  const { t } = useTranslation('auth')
  return (
    <main className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-semibold px-4">{t('login.title')}</h1>
      <LoginForm />
      <p className="px-4 mt-2">
        <Link to="/forgot-password" className="underline">
          {t('login.forgot')}
        </Link>
      </p>
      <p className="px-4 mt-2">
        <Link to="/signup" className="underline">
          {t('login.needAccount')}
        </Link>
      </p>
    </main>
  )
}
