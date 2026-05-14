import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { initI18n } from '../i18n'

describe('i18n', () => {
  it('returns the English bootstrap heading after init', async () => {
    initI18n()
    await i18next.loadNamespaces('common')
    expect(i18next.t('appBootHeading')).toBe('SD Site — foundations bootstrap')
  })
})
