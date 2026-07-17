import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { captureError } from './sentry'

export function RootErrorBoundary() {
  const { t } = useTranslation('errors')
  const error = useRouteError()

  useEffect(() => {
    captureError(error)
  }, [error])

  return (
    <main className="p-6 max-w-md mx-auto flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{t('boundary.title')}</h1>
      <p className="text-slate-600">{t('boundary.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-slate-800 text-white py-2 px-4 rounded self-start"
      >
        {t('boundary.reload')}
      </button>
    </main>
  )
}
