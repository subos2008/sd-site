import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AppError } from '../app-error'
import { reportError, dismiss, clear, getSnapshot, subscribe } from '../error-bus'

const mk = (over: Partial<AppError> = {}): AppError => ({
  kind: 'transport', name: 'RpcTransportError', message: 'boom', rpc: 'foo', ...over,
})

describe('error-bus', () => {
  beforeEach(() => clear())

  it('reports an error and notifies subscribers', () => {
    const cb = vi.fn()
    const unsub = subscribe(cb)
    reportError(mk())
    expect(getSnapshot()).toHaveLength(1)
    expect(cb).toHaveBeenCalled()
    unsub()
  })

  it('coalesces an identical head error', () => {
    reportError(mk())
    reportError(mk())
    expect(getSnapshot()).toHaveLength(1)
  })

  it('stacks distinct errors newest-first and caps at 5', () => {
    for (let i = 0; i < 7; i++) reportError(mk({ message: `e${i}` }))
    const snap = getSnapshot()
    expect(snap).toHaveLength(5)
    expect(snap[0].message).toBe('e6')
  })

  it('dismisses by index', () => {
    reportError(mk({ message: 'a' }))
    reportError(mk({ message: 'b' }))
    dismiss(0) // removes newest ('b')
    expect(getSnapshot().map((e) => e.message)).toEqual(['a'])
  })

  it('dismiss with an out-of-range index is a no-op (stable reference)', () => {
    reportError(mk({ message: 'a' }))
    const before = getSnapshot()
    dismiss(5)
    dismiss(-1)
    expect(getSnapshot()).toBe(before)
  })
})
