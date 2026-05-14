import { useTranslation } from 'react-i18next'

export default function App() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen p-8 text-2xl font-semibold text-slate-800">
      {t('appBootHeading')}
    </div>
  )
}
