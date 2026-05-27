import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditableSection } from './EditableSection'
import { useInterests, useSetProfileInterests } from '@/features/interests/hooks'

interface Interest {
  id: string
  label_key: string
  category: string
}

export function InterestsSection({ interests }: { interests: Interest[] }) {
  const { t } = useTranslation('profile')
  const { t: tInt } = useTranslation('interests')

  return (
    <EditableSection
      title={t('section.interests.title')}
      renderView={() =>
        interests.length === 0 ? (
          <p className="text-sm text-slate-600">{t('section.interests.empty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <span
                key={i.id}
                className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-sm"
              >
                {tInt(i.label_key)}
              </span>
            ))}
          </div>
        )
      }
      renderEdit={(close) => (
        <InterestsEditor existing={interests.map((i) => i.id)} onDone={close} />
      )}
    />
  )
}

function InterestsEditor({
  existing,
  onDone,
}: {
  existing: string[]
  onDone: () => void
}) {
  const { t } = useTranslation('profile')
  const { t: tInt } = useTranslation('interests')
  const { data, isLoading } = useInterests()
  const setInterests = useSetProfileInterests()
  const [selected, setSelected] = useState<Set<string>>(new Set(existing))

  if (isLoading || !data?.ok) return <p>{t('edit.saving')}…</p>

  const byCategory = new Map<string, typeof data.interests>()
  for (const it of data.interests) {
    const arr = byCategory.get(it.category) ?? []
    arr.push(it)
    byCategory.set(it.category, arr)
  }

  return (
    <div className="text-sm">
      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <section key={cat} className="mb-3">
          <h3 className="font-medium mb-2">{tInt(`category.${cat}`)}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (next.has(it.id)) next.delete(it.id)
                    else next.add(it.id)
                    return next
                  })
                }
                className={`px-3 py-1 rounded-full border ${
                  selected.has(it.id)
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-800'
                }`}
              >
                {tInt(it.label_key)}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={setInterests.isPending}
          onClick={async () => {
            await setInterests.mutateAsync(Array.from(selected))
            onDone()
          }}
          className="bg-slate-800 text-white px-3 py-1 rounded"
        >
          {t('edit.save')}
        </button>
        <button type="button" onClick={onDone} className="underline">
          {t('edit.cancel')}
        </button>
      </div>
    </div>
  )
}
