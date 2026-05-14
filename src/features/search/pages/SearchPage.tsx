import { useTranslation } from 'react-i18next'
import { useSearchFirstPage } from '../hooks'
import { ProfileCard } from '../components/ProfileCard'

export function SearchPage() {
  const { t } = useTranslation('search')
  const { data, isLoading, error } = useSearchFirstPage()
  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('error')}</p>
  return (
    <main className="p-4 grid grid-cols-2 gap-3">
      {data.cards.map((c) => <ProfileCard key={c.profile_id} card={c} />)}
    </main>
  )
}
