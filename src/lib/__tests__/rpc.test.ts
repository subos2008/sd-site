import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../test-setup'
import { callRpc, RpcContractError } from '../rpc'
import { SetProfileRoleResult } from '@shared/rpc-contracts'

describe('callRpc', () => {
  it('parses a successful response through the Zod contract', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ ok: true }),
      ),
    )
    const r = await callRpc('set_profile_role', { p_role: 'baby' }, SetProfileRoleResult)
    expect(r.ok).toBe(true)
  })

  it('throws RpcContractError when the response does not match the Zod schema', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/set_profile_role', () =>
        HttpResponse.json({ ok: 'maybe' }),
      ),
    )
    await expect(
      callRpc('set_profile_role', { p_role: 'baby' }, SetProfileRoleResult),
    ).rejects.toBeInstanceOf(RpcContractError)
  })
})
