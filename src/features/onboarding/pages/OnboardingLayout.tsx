import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

export function OnboardingLayout() {
  const { t } = useTranslation('onboarding')
  return (
    <main className="max-w-md mx-auto py-6">
      <h1 className="text-2xl font-semibold px-4 mb-2">{t('shell.title')}</h1>
      <Outlet />
    </main>
  )
}
