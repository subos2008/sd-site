import { describe, expect, it } from 'vitest'
import { initOtel, getTracer } from '../otel'

describe('otel', () => {
  it('returns a tracer (no-op when endpoint unset)', () => {
    const tracer = initOtel()
    expect(tracer).toBeDefined()
    const span = tracer.startSpan('test-span')
    span.setAttribute('app.feature', 'unit-test')
    span.end()
  })

  it('returns the same tracer on subsequent calls', () => {
    const t1 = getTracer()
    const t2 = getTracer()
    expect(t1).toBe(t2)
  })
})
