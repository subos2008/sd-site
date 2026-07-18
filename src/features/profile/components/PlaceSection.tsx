import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlaceSuggestionT } from '@shared/rpc-contracts'
import { PlaceCombobox } from '@/features/places/components/PlaceCombobox'
import { useSetLocation } from '@/features/places/hooks'
import { EditableSection } from './EditableSection'

export function PlaceSection({ city }: { city: string | null }) {
  const { t } = useTranslation('profile')
  const setLocation = useSetLocation()
  const [selected, setSelected] = useState<PlaceSuggestionT | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(close: () => void) {
    if (!selected) return
    setError(null)
    try {
      const res = await setLocation.mutateAsync({ place_id: selected.id })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSelected(null)
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    }
  }

  return (
    <EditableSection
      title={t('section.place.title')}
      renderView={() => <p className="text-sm">{city ?? t('section.place.empty')}</p>}
      renderEdit={(close) => (
        <div className="flex flex-col gap-3">
          <PlaceCombobox
            label={t('section.place.label')}
            value={selected}
            onChange={setSelected}
            initialText={city ?? ''}
          />
          {error && (
            <div role="alert" className="text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-slate-800 text-white px-3 py-1.5 rounded disabled:opacity-50"
              disabled={!selected || setLocation.isPending}
              onClick={() => void save(close)}
            >
              {setLocation.isPending ? t('edit.saving') : t('edit.save')}
            </button>
            <button type="button" className="px-3 py-1.5 border rounded" onClick={close}>
              {t('edit.cancel')}
            </button>
          </div>
        </div>
      )}
    />
  )
}
