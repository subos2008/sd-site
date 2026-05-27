import { useEffect } from 'react'
import { callRpc } from '@/lib/rpc'
import { TouchLastActiveResult } from '@shared/rpc-contracts'

export const touchLastActive = () =>
  callRpc('touch_last_active', {}, TouchLastActiveResult)

/** Mount once at app shell level. Fires touch_last_active on mount and on
 *  visibility-change to visible. Errors are silently swallowed. */
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    void touchLastActive().catch(() => {})
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void touchLastActive().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])
}
