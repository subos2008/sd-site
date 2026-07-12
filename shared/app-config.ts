export const APP_CONFIG = {
  tokens: {
    firstMessageCost: 10,
    unlockAlbumCost: 10,
    unlockReadReceiptsCost: 10,
    freeStartingTokens: 100,
  },
  media: {
    maxVideoSeconds: 60,
    maxUploadMB: 50,
    allowedPhotoMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    allowedVideoMimeTypes: ['video/mp4'] as const,
  },
  age: { minimum: 18 },
  onboarding: {
    // Baby (supply-side) activation gate. Structure is the fraud gate;
    // numbers are tuning — start modest, ratchet toward the incumbent bar
    // (~6 photos) as density and brand trust grow. See execution/010.
    babyMinPhotos: 3,
    babyMinBioChars: 40,
  },
  payments: {
    provider: 'faux' as 'faux' | 'segpay',
    packages: [
      { id: 'starter', tokens: 50, priceCents: 4999, currency: 'GBP' as const },
      { id: 'plus', tokens: 150, priceCents: 12999, currency: 'GBP' as const },
      { id: 'premium', tokens: 500, priceCents: 39999, currency: 'GBP' as const },
    ],
  },
} as const

export type AppConfig = typeof APP_CONFIG
