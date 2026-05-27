import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import enCommon from '../i18n/en/common.json'
import enAuth from '../i18n/en/auth.json'
import enOnboarding from '../i18n/en/onboarding.json'
import enSearch from '../i18n/en/search.json'
import enProfile from '../i18n/en/profile.json'
import enShell from '../i18n/en/shell.json'
import enInterests from '../i18n/en/interests.json'
import enLikes from '../i18n/en/likes.json'
import enNotifications from '../i18n/en/notifications.json'

export function initI18n(): Promise<unknown> {
  return i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: {
          common: enCommon,
          auth: enAuth,
          onboarding: enOnboarding,
          search: enSearch,
          profile: enProfile,
          shell: enShell,
          interests: enInterests,
          likes: enLikes,
          notifications: enNotifications,
        },
      },
      fallbackLng: 'en',
      defaultNS: 'common',
      keySeparator: false,
      nsSeparator: ':',
      interpolation: { escapeValue: false },
    })
}
