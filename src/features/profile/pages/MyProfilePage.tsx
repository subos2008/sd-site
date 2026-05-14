import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useMyProfile } from '../hooks'

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
    return () => { cancelled = true }
  }, [path])
  return (
    <div className="aspect-square bg-slate-200 rounded overflow-hidden">
      {url ? <img src={url} alt={alt} className="w-full h-full object-cover" /> : null}
    </div>
  )
}

export function MyProfilePage() {
  const { t } = useTranslation('profile')
  const { data, isLoading, error } = useMyProfile()

  if (isLoading) return <p className="p-4">{t('loading')}</p>
  if (error || !data?.ok) return <p className="p-4 text-red-700">{t('notFound')}</p>

  const p = data.profile
  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">
          {p.display_name ?? ''}{p.age != null ? `, ${p.age}` : ''}
        </h1>
        <p className="text-slate-600">{p.city_display_name}</p>
        <p className="text-sm text-slate-500">
          {p.gender} · looking for {p.looking_for}
        </p>
      </header>
      <dl className="text-sm grid grid-cols-2 gap-2">
        <dt className="text-slate-500">{t('yourStatus')}</dt>
        <dd>{p.status}</dd>
        <dt className="text-slate-500">{t('yourRole')}</dt>
        <dd>{p.role ?? ''}</dd>
        <dt className="text-slate-500">{t('yourTokens')}</dt>
        <dd>{p.token_balance}</dd>
      </dl>
      <section className="grid grid-cols-2 gap-3">
        {p.photos.map((ph) => (
          <ProfilePhoto key={ph.ordinal} path={ph.path} alt={p.display_name ?? ''} />
        ))}
      </section>
    </main>
  )
}
