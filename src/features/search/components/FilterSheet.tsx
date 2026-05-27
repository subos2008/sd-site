import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInterests } from '@/features/interests/hooks'
import type { ParsedFilters } from '../hooks'

interface Props {
  open: boolean
  onClose: () => void
  initial: ParsedFilters
  onApply: (next: ParsedFilters) => void
}

export function FilterSheet({ open, onClose, initial, onApply }: Props) {
  const { t } = useTranslation('search')
  const { t: tInt } = useTranslation('interests')
  const { data } = useInterests()
  const [draft, setDraft] = useState<ParsedFilters>(initial)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label={t('filter.title')}
      className="fixed inset-0 bg-white p-4 overflow-y-auto z-10"
    >
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{t('filter.title')}</h2>
        <button type="button" onClick={onClose} aria-label={t('filter.close')}>
          ✕
        </button>
      </header>

      <fieldset className="mb-4">
        <legend className="font-medium mb-2">{t('filter.age')}</legend>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="block text-sm">{t('filter.min_age')}</span>
            <input
              type="number"
              min={18}
              max={99}
              className="border rounded p-2 w-full"
              value={draft.min_age ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  min_age: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="flex-1">
            <span className="block text-sm">{t('filter.max_age')}</span>
            <input
              type="number"
              min={18}
              max={99}
              className="border rounded p-2 w-full"
              value={draft.max_age ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  max_age: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="font-medium mb-2">{t('filter.distance')}</legend>
        <input
          type="number"
          min={1}
          max={1000}
          className="border rounded p-2 w-full"
          value={draft.distance_miles ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              distance_miles: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </fieldset>

      {data?.ok && (
        <fieldset className="mb-4">
          <legend className="font-medium mb-2">{t('filter.interests')}</legend>
          <div className="flex flex-wrap gap-2">
            {data.interests.map((i) => {
              const on = (draft.interest_ids ?? []).includes(i.id)
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    const cur = new Set(draft.interest_ids ?? [])
                    if (on) cur.delete(i.id)
                    else cur.add(i.id)
                    setDraft({ ...draft, interest_ids: Array.from(cur) })
                  }}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    on ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'
                  }`}
                >
                  {tInt(i.label_key)}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="flex gap-2 sticky bottom-0 bg-white pt-4">
        <button type="button" onClick={() => setDraft({})} className="underline">
          {t('filter.reset')}
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(draft)
            onClose()
          }}
          className="ml-auto bg-slate-800 text-white px-4 py-2 rounded"
        >
          {t('filter.apply')}
        </button>
      </div>
    </div>
  )
}
