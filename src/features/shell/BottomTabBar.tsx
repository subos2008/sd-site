import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useUnreadCount } from '@/lib/notifications/hooks'

export function BottomTabBar() {
  const { t } = useTranslation('shell')
  const { data } = useUnreadCount()
  const likesDot = data?.ok && data.count > 0

  const tabs = [
    { to: '/search', label: t('tab.search'), showDot: false },
    { to: '/messages', label: t('tab.messages'), showDot: false },
    { to: '/likes', label: t('tab.likes'), showDot: likesDot },
    { to: '/me', label: t('tab.me'), showDot: false },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 text-center py-3 relative ${isActive ? 'font-semibold' : ''}`
          }
        >
          {tab.label}
          {tab.showDot && (
            <span
              aria-label="unread"
              className="absolute top-2 right-1/3 inline-block w-2 h-2 rounded-full bg-rose-600"
            />
          )}
        </NavLink>
      ))}
    </nav>
  )
}
