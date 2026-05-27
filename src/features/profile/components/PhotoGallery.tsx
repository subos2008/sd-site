import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useUploadProfilePhoto } from '@/features/onboarding/hooks'
import { useReorderPhotos, useRemovePhoto } from '../hooks'

interface PhotoRow {
  ordinal: number
  path: string
  media_item_id: string
}

export function PhotoGallery({ photos }: { photos: PhotoRow[] }) {
  const { t } = useTranslation('profile')
  const upload = useUploadProfilePhoto()
  const reorder = useReorderPhotos()
  const remove = useRemovePhoto()
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      photos.map((p) =>
        supabase.storage
          .from('media')
          .createSignedUrl(p.path, 3600)
          .then(({ data }) => [p.path, data?.signedUrl] as const),
      ),
    ).then((entries) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [path, url] of entries) if (url) next[path] = url
      setUrls(next)
    })
    return () => {
      cancelled = true
    }
  }, [photos])

  function moveUp(idx: number) {
    if (idx === 0) return
    const ordered = [...photos]
    const [moved] = ordered.splice(idx, 1)
    ordered.splice(idx - 1, 0, moved)
    void reorder.mutateAsync(ordered.map((p) => p.media_item_id))
  }

  function moveDown(idx: number) {
    if (idx === photos.length - 1) return
    const ordered = [...photos]
    const [moved] = ordered.splice(idx, 1)
    ordered.splice(idx + 1, 0, moved)
    void reorder.mutateAsync(ordered.map((p) => p.media_item_id))
  }

  return (
    <section className="border rounded-lg p-4 mb-3 bg-white">
      <h2 className="font-semibold mb-2">{t('section.photos.title')}</h2>
      <p className="text-xs text-slate-600 mb-2">{t('section.photos.reorderHint')}</p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div
            key={p.media_item_id}
            className="relative aspect-square bg-slate-200 rounded overflow-hidden"
          >
            {urls[p.path] && (
              <img src={urls[p.path]} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 text-white text-xs p-1">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                aria-label="up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === photos.length - 1}
                aria-label="down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(p.media_item_id)}
                aria-label={t('section.photos.remove')}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="mt-3 inline-block">
        <span className="bg-slate-800 text-white px-3 py-1 rounded cursor-pointer">
          {t('section.photos.add')}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload.mutate({ file: f, ordinal: photos.length })
            e.currentTarget.value = ''
          }}
        />
      </label>
    </section>
  )
}
