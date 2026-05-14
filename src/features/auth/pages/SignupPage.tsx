import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SignupForm } from '../components/SignupForm'

export function SignupPage() {
  const { t } = useTranslation('auth')
  return (
    <main className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-semibold px-4">{t('signup.title')}</h1>
      <SignupForm />
      <p className="px-4 mt-2">
        <Link to="/login" className="underline">
          {t('signup.haveAccount')}
        </Link>
      </p>
    </main>
  )
}
