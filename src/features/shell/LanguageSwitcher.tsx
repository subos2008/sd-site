import { useTranslation } from 'react-i18next'

const SUPPORTED = [{ code: 'en', labelKey: 'language.en' }]

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('shell')
  return (
    <label className="flex items-center gap-2 py-2">
      <span>{t('menu.language')}</span>
      <select
        className="border rounded p-1"
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {SUPPORTED.map((s) => (
          <option key={s.code} value={s.code}>
            {t(s.labelKey)}
          </option>
        ))}
      </select>
    </label>
  )
}
