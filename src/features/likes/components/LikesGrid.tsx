import { ProfileCard } from '@/features/search/components/ProfileCard'
import type { ProfileCardV2T } from '@shared/rpc-contracts'

export function LikesGrid({ cards }: { cards: ProfileCardV2T[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <ProfileCard key={c.profile_id} card={c} />
      ))}
    </div>
  )
}
