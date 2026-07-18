// Distance: en-GB and en-US use miles; everyone else uses km.
// Disc-model semantics: 0 means same/overlapping places — the place name
// carries the information, so render nothing rather than a fake "0 mi".
const MILE_LANGS = ['en-GB', 'en-US']

export function formatDistance(miles: number | null, locale: string): string {
  if (miles == null || miles <= 0) return ''
  const useMiles = MILE_LANGS.includes(locale)
  const value = useMiles ? miles : miles * 1.609344
  const unit  = useMiles ? 'mi' : 'km'
  return `~${Math.max(1, Math.round(value))} ${unit}`
}

export function formatAge(age: number | null): string {
  if (age == null) return ''
  return String(age)
}
