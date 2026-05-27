import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  renderView: () => ReactNode
  renderEdit: (close: () => void) => ReactNode
}

export function EditableSection({ title, renderView, renderEdit }: Props) {
  const { t } = useTranslation('profile')
  const [editing, setEditing] = useState(false)
  return (
    <section className="border rounded-lg p-4 mb-3 bg-white">
      <header className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="underline text-sm">
            {t('edit.edit')}
          </button>
        )}
      </header>
      {editing ? renderEdit(() => setEditing(false)) : renderView()}
    </section>
  )
}
