import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { Session } from '@supabase/supabase-js'
import { mswServer } from '../../../test-setup'
import { useSignupBootstrap } from '../useSignupBootstrap'
import { AuthContext } from '@/lib/auth-context'
import { createQueryClient } from '@/lib/query-client'
import type { ReactNode } from 'react'

function wrap(meta: Record<string, unknown>) {
  const session = { user: { id: 'u1', user_metadata: meta } } as unknown as Session
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <AuthContext.Provider value={{ status: 'authenticated', session }}>
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }
  return Wrapper
}

describe('useSignupBootstrap', () => {
  it('commits body_type + ethnicity from metadata via set_profile_details', async () => {
    let body: unknown = null
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({ body_type: 'curvy', ethnicity: 'asian' }) })
    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toMatchObject({ p_body_type: 'curvy', p_ethnicity: 'asian' })
  })

  it('does nothing when metadata has no captured fields', async () => {
    let called = false
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_details', () => {
        called = true
        return HttpResponse.json({ ok: true })
      }),
    )
    renderHook(() => useSignupBootstrap(), { wrapper: wrap({}) })
    await new Promise((r) => setTimeout(r, 50))
    expect(called).toBe(false)
  })
})
