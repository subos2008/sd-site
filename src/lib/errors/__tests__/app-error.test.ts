import { describe, it, expect } from 'vitest'
import { RpcTransportError, RpcContractError } from '@/lib/rpc'
import { toAppError } from '../app-error'

describe('toAppError', () => {
  it('maps a transport error to POST + rpc path', () => {
    const e = toAppError(new RpcTransportError('set_profile_role', { status: 500 }))
    expect(e.kind).toBe('transport')
    expect(e.name).toBe('RpcTransportError')
    expect(e.rpc).toBe('set_profile_role')
    expect(e.method).toBe('POST')
    expect(e.path).toBe('/rest/v1/rpc/set_profile_role')
    expect(e.status).toBe(500)
  })

  it('leaves status undefined when the cause has none', () => {
    const e = toAppError(new RpcTransportError('foo', { code: 'PGRST' }))
    expect(e.kind).toBe('transport')
    expect(e.status).toBeUndefined()
  })

  it('maps a contract error', () => {
    const e = toAppError(new RpcContractError('view_search', []))
    expect(e.kind).toBe('contract')
    expect(e.name).toBe('RpcContractError')
    expect(e.rpc).toBe('view_search')
    expect(e.message).toContain('view_search')
  })

  it('maps a plain Error to render kind', () => {
    const e = toAppError(new TypeError('cannot read x'))
    expect(e.kind).toBe('render')
    expect(e.name).toBe('TypeError')
    expect(e.message).toBe('cannot read x')
  })

  it('maps a non-Error throw to unknown', () => {
    const e = toAppError('a string')
    expect(e.kind).toBe('unknown')
    expect(e.message).toBe('a string')
  })
})
