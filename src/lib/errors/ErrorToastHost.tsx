import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { subscribe, getSnapshot, dismiss } from './error-bus'

export function ErrorToastHost() {
  const { t } = useTranslation('errors')
  const errors = useSyncExternalStore(subscribe, getSnapshot)

  if (errors.length === 0) return null

  return (
    <div className="fixed top-2 inset-x-2 max-w-sm mx-auto z-50 flex flex-col gap-2">
      {errors.map((e, i) => (
        <div
          key={i}
          role="alert"
          aria-live="assertive"
          className="rounded-lg shadow-lg bg-red-700 text-white p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm">{e.name}</div>
              <div className="text-sm break-words">{e.message}</div>
              {e.kind === 'transport' && (
                <div className="text-xs font-mono opacity-90 mt-1 break-all">
                  {e.method} {e.path}
                  {e.status != null ? ` · ${e.status}` : ''}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(i)}
              aria-label={t('toast.dismiss')}
              className="text-white/90 shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
