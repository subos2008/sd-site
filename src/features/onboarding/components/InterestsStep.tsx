import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useInterests, useSetInterests } from '../hooks'

type InterestItem = {
  id: string
  label_key: string
  category: string
  ordinal?: number
}

export function InterestsStep() {
  const { t } = useTranslation('onboarding')
  const { t: tInt } = useTranslation('interests')
  const navigate = useNavigate()
  const { data, isLoading } = useInterests()
  const setInterests = useSetInterests()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (isLoading || !data || !data.ok) {
    return <p className="p-4">{t('interests.title')}…</p>
  }

  const byCategory = new Map<string, InterestItem[]>()
  for (const it of data.interests) {
    const arr = byCategory.get(it.category) ?? []
    arr.push(it)
    byCategory.set(it.category, arr)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function onContinue() {
    await setInterests.mutateAsync(Array.from(selected))
    navigate('/onboarding/complete')
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">{t('interests.title')}</h2>
      <p className="text-sm text-slate-600 mb-4">{t('interests.subtitle')}</p>
      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <section key={cat} className="mb-4">
          <h3 className="font-medium mb-2">{tInt(`category.${cat}`)}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                className={`px-3 py-1 rounded-full border ${
                  selected.has(it.id) ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'
                }`}
              >
                {tInt(it.label_key)}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-between mt-4">
        <button
          type="button"
          onClick={() => navigate('/onboarding/complete')}
          className="underline"
        >
          {t('interests.skip')}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={setInterests.isPending}
          className="bg-slate-800 text-white px-4 py-2 rounded"
        >
          {t('interests.continue')}
        </button>
      </div>
    </div>
  )
}
