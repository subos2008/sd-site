import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { ProfileCardV2T } from '@shared/rpc-contracts'
import { formatDistance } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { LikeButton } from '@/features/likes/components/LikeButton'

export function ProfileCard({ card }: { card: ProfileCardV2T }) {
  const { i18n } = useTranslation()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!card.primary_photo_path) {
      // Clear asynchronously so we don't call setState within the effect body.
      queueMicrotask(() => {
        if (!cancelled) setPhotoUrl(null)
      })
      return () => {
        cancelled = true
      }
    }
    void supabase.storage
      .from('media')
      .createSignedUrl(card.primary_photo_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [card.primary_photo_path])

  return (
    <Link
      to={`/profile/${card.profile_id}`}
      className="relative block border rounded-lg overflow-hidden bg-white"
    >
      <div className="aspect-square bg-slate-200">
        {photoUrl ? (
          <img src={photoUrl} alt={card.display_name} className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="absolute top-2 right-2">
        <LikeButton profileId={card.profile_id} liked={card.my_like_state} />
      </div>
      <div className="p-2">
        <div className="font-semibold">
          {card.display_name}, {card.age}
        </div>
        <div className="text-sm text-slate-600">
          {card.city_display_name}
          {(() => {
            const d = formatDistance(card.distance_miles, i18n.language)
            return d ? ` · ${d}` : ''
          })()}
        </div>
        {card.tagline && (
          <div className="text-xs italic text-slate-700 mt-1 truncate">{card.tagline}</div>
        )}
      </div>
    </Link>
  )
}
