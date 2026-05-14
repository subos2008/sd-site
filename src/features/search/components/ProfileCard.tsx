import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { ProfileCardT } from '@shared/rpc-contracts'
import { formatDistance } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export function ProfileCard({ card }: { card: ProfileCardT }) {
  const { i18n } = useTranslation()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!card.primary_photo_path) return
    void supabase.storage
      .from('media')
      .createSignedUrl(card.primary_photo_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl)
      })
    return () => { cancelled = true }
  }, [card.primary_photo_path])

  return (
    <Link to={`/profile/${card.profile_id}`}
          className="block border rounded-lg overflow-hidden bg-white">
      <div className="aspect-square bg-slate-200">
        {photoUrl ? <img src={photoUrl} alt={card.display_name} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="p-2">
        <div className="font-semibold">{card.display_name}, {card.age}</div>
        <div className="text-sm text-slate-600">
          {card.city_display_name} · {formatDistance(card.distance_miles, i18n.language)}
        </div>
      </div>
    </Link>
  )
}
