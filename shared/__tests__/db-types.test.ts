import { describe, expect, it } from 'vitest'
import type { Database } from '../db-types'

describe('db-types', () => {
  it('exports a Database type with public.app_config', () => {
    const _typeCheck: Database['public']['Tables']['app_config']['Row'] = {
      key: 'sample',
      value: {} as never,
    }
    expect(_typeCheck.key).toBe('sample')
  })
})
