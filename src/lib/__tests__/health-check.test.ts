import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { mswServer } from '../../test-setup'
import { supabase } from '../supabase'
import { HealthCheckResult } from '@shared/rpc-contracts'

describe('health_check (MSW-mocked Supabase RPC)', () => {
  it('parses the response through the Zod contract', async () => {
    mswServer.use(
      http.post('http://127.0.0.1:54321/rest/v1/rpc/health_check', () =>
        HttpResponse.json({ ok: true, service: 'sd-site' }),
      ),
    )

    const { data, error } = await supabase.rpc('health_check' as never)
    expect(error).toBeNull()

    const parsed = HealthCheckResult.parse(data)
    expect(parsed.ok).toBe(true)
    expect(parsed.service).toBe('sd-site')
  })
})
