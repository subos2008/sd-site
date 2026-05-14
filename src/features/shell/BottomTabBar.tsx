import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'

export function BottomTabBar() {
  const { t } = useTranslation('shell')
  const tabs = [
    { to: '/search', label: t('tab.search') },
    { to: '/messages', label: t('tab.messages') },
    { to: '/likes', label: t('tab.likes') },
    { to: '/me', label: t('tab.me') },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 text-center py-3 ${isActive ? 'font-semibold' : ''}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
