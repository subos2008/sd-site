import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchFirstPage, useSearchFilters } from '../hooks'
import { ProfileCard } from '../components/ProfileCard'
import { FilterSheet } from '../components/FilterSheet'

export function SearchPage() {
  const { t } = useTranslation('search')
  const [filters, setFilters] = useSearchFilters()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { data, isLoading, error } = useSearchFirstPage(filters)

  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('error')}</p>

  return (
    <>
      <main className="p-4">
        <div className="flex justify-between mb-3">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="text-sm border rounded px-3 py-1"
          >
            {t('filter.open')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {data.cards.map((c) => (
            <ProfileCard key={c.profile_id} card={c} />
          ))}
        </div>
      </main>
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initial={filters}
        onApply={setFilters}
      />
    </>
  )
}
