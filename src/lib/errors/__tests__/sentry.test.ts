import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn() }))
import * as Sentry from '@sentry/react'
import { initSentry, captureError, __resetSentryForTest } from '../sentry'

describe('sentry', () => {
  beforeEach(() => {
    __resetSentryForTest()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('does not initialize without a DSN', () => {
    initSentry()
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('initializes errors-only when a DSN is set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o.ingest.sentry.io/1')
    initSentry()
    expect(Sentry.init).toHaveBeenCalledOnce()
    const cfg = (Sentry.init as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as Record<string, unknown>
    expect(cfg.sendDefaultPii).toBe(true)
    expect(cfg.tracesSampleRate).toBe(0)
    expect(cfg.integrations).toEqual([])
  })

  it('captureError no-ops until initialized', () => {
    captureError(new Error('x'))
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('captureError forwards to Sentry once initialized', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o.ingest.sentry.io/1')
    initSentry()
    const e = new Error('boom')
    captureError(e, { rpc: 'foo' })
    expect(Sentry.captureException).toHaveBeenCalledWith(e, { extra: { rpc: 'foo' } })
  })
})
