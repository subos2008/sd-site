import { useTranslation } from 'react-i18next'
import { AuthShell } from '@/features/auth/components/AuthShell'

export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t } = useTranslation('legal')
  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold">{t(`${doc}.title`)}</h1>
      <p className="mt-6 leading-relaxed text-bone/70">{t(`${doc}.body`)}</p>
    </AuthShell>
  )
}
