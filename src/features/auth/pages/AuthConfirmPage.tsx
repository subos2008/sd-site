import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'

export function AuthConfirmPage() {
  const { t } = useTranslation('auth')
  const [status, setStatus] = useState<'pending' | 'ok' | 'fail'>('pending')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'ok' : 'fail')
    })
  }, [])

  if (status === 'pending') return <p className="p-4">…</p>
  if (status === 'ok') {
    return (
      <p className="p-4">
        {t('confirm.success')}{' '}
        <Link to="/onboarding/role" className="underline">
          →
        </Link>
      </p>
    )
  }
  return <p className="p-4">{t('confirm.failure')}</p>
}
