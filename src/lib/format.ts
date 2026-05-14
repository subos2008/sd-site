// Distance: en-GB and en-US use miles; everyone else uses km.
const MILE_LANGS = ['en-GB', 'en-US']

export function formatDistance(miles: number | null, locale: string): string {
  if (miles == null) return ''
  const useMiles = MILE_LANGS.includes(locale)
  const value = useMiles ? miles : miles * 1.609344
  const unit  = useMiles ? 'mi' : 'km'
  return `${Math.round(value)} ${unit}`
}

export function formatAge(age: number | null): string {
  if (age == null) return ''
  return String(age)
}
