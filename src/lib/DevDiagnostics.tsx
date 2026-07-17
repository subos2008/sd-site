import { useEffect, useState } from 'react'
import { useSession } from './auth-context'
import { supabase } from './supabase'

export const DIAG_VERSION = 'diag-2026-07-17-a'

/**
 * Dev-only overlay for debugging auth/session state in a real browser.
 * Shows which code the tab is executing, what the auth layer believes,
 * which service worker controls the page, and the auth server's live
 * verdict on the stored token. Remove once the stale-session saga ends.
 */
export function DevDiagnostics() {
  const { status, session } = useSession()
  const [probe, setProbe] = useState('probing…')
  const [swUrl, setSwUrl] = useState('none')

  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data, error }) =>
        setProbe(
          error
            ? `getUser error status=${String(error.status)} ${error.message}`
            : `getUser ok user=${data.user?.id?.slice(0, 8) ?? 'null'}`,
        ),
      )
      .catch((e: unknown) => setProbe(`getUser threw ${e instanceof Error ? e.message : '?'}`))
    const t = setTimeout(
      () => setSwUrl(navigator.serviceWorker?.controller?.scriptURL ?? 'none'),
      0,
    )
    return () => clearTimeout(t)
  }, [status])

  const sbKeys = Object.keys(localStorage).filter((k) => k.startsWith('sb-'))
  const lines = [
    `ver: ${DIAG_VERSION}`,
    `path: ${window.location.pathname}${window.location.search}`,
    `auth status: ${status} (user ${session?.user?.id?.slice(0, 8) ?? 'none'})`,
    `sb localStorage keys: ${sbKeys.join(', ') || 'none'}`,
    `server: ${probe}`,
    `sw: ${swUrl}`,
  ]
  console.log('[diag]', lines.join(' | '))

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 4,
        left: 4,
        zIndex: 99999,
        background: '#000c',
        color: '#7CFC00',
        font: '11px/1.5 monospace',
        padding: '6px 8px',
        borderRadius: 4,
        maxWidth: '95vw',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
      }}
    >
      {lines.join('\n')}
    </div>
  )
}
