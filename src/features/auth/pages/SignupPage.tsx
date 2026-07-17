import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ProfileRole } from '@shared/rpc-contracts'
import { SignupForm } from '../components/SignupForm'

export function SignupPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const parsed = ProfileRole.safeParse(searchParams.get('role'))
  const roleHint = parsed.success ? parsed.data : undefined
  return (
    <main className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-semibold px-4">
        {roleHint ? t(`signup.title.${roleHint}`) : t('signup.title')}
      </h1>
      <SignupForm roleHint={roleHint} />
      <p className="px-4 mt-2">
        <Link to="/login" className="underline">
          {t('signup.haveAccount')}
        </Link>
      </p>
    </main>
  )
}
