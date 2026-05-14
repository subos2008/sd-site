import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BottomTabBar } from './BottomTabBar'
import { HamburgerMenu } from './HamburgerMenu'

export function AppShell() {
  const { t } = useTranslation('shell')
  return (
    <div className="min-h-screen pb-14">
      <header className="border-b flex items-center justify-between p-2">
        <span className="font-semibold">{t('appName')}</span>
        <HamburgerMenu />
      </header>
      <Outlet />
      <BottomTabBar />
    </div>
  )
}
