import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ProfileRole } from '@shared/rpc-contracts'
import { SignupForm } from '../components/SignupForm'
import { AuthShell } from '../components/AuthShell'

export function SignupPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const parsed = ProfileRole.safeParse(searchParams.get('role'))
  const roleHint = parsed.success ? parsed.data : undefined
  const accent =
    roleHint === 'baby' ? 'text-rose' : roleHint === 'benefactor' ? 'text-champagne' : 'text-bone'
  return (
    <AuthShell>
      {roleHint ? (
        <p className="text-sm tracking-[0.2em] text-smoke uppercase">{t('signup.free')}</p>
      ) : null}
      <h1 className={`font-display mt-2 text-3xl font-semibold ${accent}`}>
        {roleHint ? t(`signup.title.${roleHint}`) : t('signup.title')}
      </h1>
      {roleHint ? (
        <p className="mt-3 leading-relaxed text-bone/70">{t(`signup.sub.${roleHint}`)}</p>
      ) : null}
      <SignupForm roleHint={roleHint} />
      <p className="mt-6 text-sm text-bone/70">
        <Link to="/login" className="underline hover:text-bone">
          {t('signup.haveAccount')}
        </Link>
      </p>
    </AuthShell>
  )
}
