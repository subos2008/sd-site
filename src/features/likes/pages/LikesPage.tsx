import { useTranslation } from 'react-i18next'
import { useLikesTab } from '../hooks'
import { LikesGrid } from '../components/LikesGrid'

export function LikesPage() {
  const { t } = useTranslation('likes')
  const { data, isLoading, error } = useLikesTab()
  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('error')}</p>

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-2">{t('title')}</h1>
      <section className="mb-6">
        <h2 className="font-medium mb-2">{t('tab.liked_me')}</h2>
        {data.liked_me.length === 0 ? (
          <p className="text-sm text-slate-600">{t('empty.liked_me')}</p>
        ) : (
          <LikesGrid cards={data.liked_me} />
        )}
      </section>
      <section>
        <h2 className="font-medium mb-2">{t('tab.favourites')}</h2>
        {data.favourites.length === 0 ? (
          <p className="text-sm text-slate-600">{t('empty.favourites')}</p>
        ) : (
          <LikesGrid cards={data.favourites} />
        )}
      </section>
    </main>
  )
}
