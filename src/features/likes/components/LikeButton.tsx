import { useTranslation } from 'react-i18next'
import { useLike, useUnlike } from '../hooks'

interface Props {
  profileId: string
  liked: boolean
}

export function LikeButton({ profileId, liked }: Props) {
  const { t } = useTranslation('likes')
  const like = useLike()
  const unlike = useUnlike()
  const pending = like.isPending || unlike.isPending

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={liked}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (liked) unlike.mutate(profileId)
        else like.mutate(profileId)
      }}
      className={`px-2 py-1 rounded text-sm ${
        liked ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 border border-rose-600'
      }`}
    >
      {liked ? '♥' : '♡'} {liked ? t('button.unlike') : t('button.like')}
    </button>
  )
}
