import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotificationsPoll, useDismissNotification } from './hooks'

interface BannerEntry {
  id: string
  kind: 'like' | 'placeholder'
  actor_name?: string
  payload: Record<string, unknown>
}

export function BannerHost() {
  const { t } = useTranslation('notifications')
  const { data } = useNotificationsPoll()
  const dismiss = useDismissNotification()
  const seenIds = useRef<Set<string>>(new Set())
  const [queue, setQueue] = useState<BannerEntry[]>([])

  useEffect(() => {
    if (!data?.ok) return
    const fresh = data.notifications.filter((n) => !seenIds.current.has(n.id))
    if (fresh.length === 0) return
    for (const n of fresh) seenIds.current.add(n.id)
    setQueue((prev) => [
      ...prev,
      ...fresh.map((n) => ({
        id: n.id,
        kind: n.kind,
        actor_name:
          typeof n.payload['actor_name'] === 'string'
            ? (n.payload['actor_name'] as string)
            : undefined,
        payload: n.payload,
      })),
    ])
  }, [data])

  // Auto-dismiss after 5s
  useEffect(() => {
    if (queue.length === 0) return
    const id = setTimeout(() => setQueue((prev) => prev.slice(1)), 5000)
    return () => clearTimeout(id)
  }, [queue])

  if (queue.length === 0) return null
  const head = queue[0]

  return (
    <div
      className="fixed top-2 inset-x-2 max-w-sm mx-auto rounded-lg shadow-lg bg-slate-800 text-white p-3 z-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{t(`banner.${head.kind}.title`)}</div>
          <div className="text-sm">
            {t(`banner.${head.kind}.body`, { actor_name: head.actor_name ?? 'Someone' })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            dismiss.mutate(head.id)
            setQueue((prev) => prev.slice(1))
          }}
          aria-label={t('banner.dismiss')}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
