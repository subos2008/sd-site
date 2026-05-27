import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signOut } from '@/features/auth/api'
import { LanguageSwitcher } from './LanguageSwitcher'

export function HamburgerMenu() {
  const { t } = useTranslation('shell')
  const [open, setOpen] = useState(false)
  return (
    <>
      <button aria-label={t('menu.open')} onClick={() => setOpen(true)} className="p-2">
        ☰
      </button>
      {open ? (
        <div role="dialog" className="fixed inset-0 bg-white p-4">
          <button
            onClick={() => setOpen(false)}
            aria-label={t('menu.close')}
            className="mb-4"
          >
            ✕
          </button>
          <LanguageSwitcher />
          <button onClick={() => void signOut()} className="block w-full text-left py-2">
            {t('menu.signOut')}
          </button>
        </div>
      ) : null}
    </>
  )
}
