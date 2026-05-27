import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useProfile } from '../hooks'

function ProfilePhoto({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void supabase.storage
      .from('media')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [path])
  return (
    <div className="aspect-square bg-slate-200 rounded overflow-hidden">
      {url ? <img src={url} alt={alt} className="w-full h-full object-cover" /> : null}
    </div>
  )
}

function fmt(v: string | number | boolean | null): string {
  if (v === null) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  return v.replace(/_/g, ' ')
}

export function ProfilePage() {
  const { t } = useTranslation('profile')
  const { t: tInt } = useTranslation('interests')
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useProfile(id ?? '')

  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('notFound')}</p>

  const p = data.profile
  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">
          {p.display_name}, {p.age}
        </h1>
        <p className="text-slate-600">{p.city_display_name}</p>
        <p className="text-sm text-slate-500">
          {p.gender} · looking for {p.looking_for}
        </p>
      </header>
      <section className="grid grid-cols-2 gap-3">
        {p.photos.map((ph) => (
          <ProfilePhoto key={ph.ordinal} path={ph.path} alt={p.display_name} />
        ))}
      </section>

      <section className="border rounded-lg p-4 mb-3 bg-white">
        <h2 className="font-semibold mb-2">{t('section.bio.title')}</h2>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div>
            <dt className="font-medium">{t('section.bio.tagline')}</dt>
            <dd>{p.tagline || '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('section.bio.about')}</dt>
            <dd className="whitespace-pre-wrap">{p.about || '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('section.bio.wants')}</dt>
            <dd className="whitespace-pre-wrap">{p.wants || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="border rounded-lg p-4 mb-3 bg-white">
        <h2 className="font-semibold mb-2">{t('section.details.title')}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="font-medium">{t('section.details.height')}</dt>
          <dd>{p.height_cm == null ? '—' : `${p.height_cm} cm`}</dd>
          <dt className="font-medium">{t('section.details.body_type')}</dt>
          <dd>{fmt(p.body_type)}</dd>
          <dt className="font-medium">{t('section.details.hair_color')}</dt>
          <dd>{fmt(p.hair_color)}</dd>
          <dt className="font-medium">{t('section.details.eye_color')}</dt>
          <dd>{fmt(p.eye_color)}</dd>
          <dt className="font-medium">{t('section.details.piercings')}</dt>
          <dd>{fmt(p.has_piercings)}</dd>
          <dt className="font-medium">{t('section.details.tattoos')}</dt>
          <dd>{fmt(p.has_tattoos)}</dd>
          <dt className="font-medium">{t('section.details.smoking')}</dt>
          <dd>{fmt(p.smoking)}</dd>
          <dt className="font-medium">{t('section.details.drinking')}</dt>
          <dd>{fmt(p.drinking)}</dd>
          <dt className="font-medium">{t('section.details.education')}</dt>
          <dd>{fmt(p.education)}</dd>
          <dt className="font-medium">{t('section.details.yearly_income_band')}</dt>
          <dd>{fmt(p.yearly_income_band)}</dd>
          <dt className="font-medium">{t('section.details.net_worth_band')}</dt>
          <dd>{fmt(p.net_worth_band)}</dd>
        </dl>
      </section>

      <section className="border rounded-lg p-4 mb-3 bg-white">
        <h2 className="font-semibold mb-2">{t('section.interests.title')}</h2>
        {p.interests.length === 0 ? (
          <p className="text-sm text-slate-600">{t('section.interests.empty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {p.interests.map((i) => (
              <span
                key={i.id}
                className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-sm"
              >
                {tInt(i.label_key)}
              </span>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
