import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/errors/sentry', () => ({ captureError: vi.fn(), initSentry: vi.fn() }))
vi.mock('@/lib/errors/error-bus', () => ({ reportError: vi.fn() }))

import { RpcTransportError } from '@/lib/rpc'
import { captureError } from '@/lib/errors/sentry'
import { reportError } from '@/lib/errors/error-bus'
import { createQueryClient } from '../query-client'

describe('createQueryClient global error surface', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports and captures a mutation error with no opt-out meta', () => {
    const client = createQueryClient()
    const onError = client.getMutationCache().config.onError!
    onError(
      new RpcTransportError('set_profile_role', { status: 500 }),
      undefined,
      undefined,
      { meta: undefined } as never,
      {} as never
    )
    expect(reportError).toHaveBeenCalledOnce()
    expect(captureError).toHaveBeenCalledOnce()
    expect((reportError as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toMatchObject({
      kind: 'transport',
      rpc: 'set_profile_role',
    })
  })

  it('suppresses surfacing when meta.suppressGlobalError is true', () => {
    const client = createQueryClient()
    const onError = client.getMutationCache().config.onError!
    onError(
      new RpcTransportError('set_profile_role', {}),
      undefined,
      undefined,
      { meta: { suppressGlobalError: true } } as never,
      {} as never
    )
    expect(reportError).not.toHaveBeenCalled()
    expect(captureError).not.toHaveBeenCalled()
  })

  it('reports a query error with no opt-out meta', () => {
    const client = createQueryClient()
    const onError = client.getQueryCache().config.onError!
    onError(new RpcTransportError('view_search', {}), { meta: undefined } as never)
    expect(reportError).toHaveBeenCalledOnce()
  })
})
