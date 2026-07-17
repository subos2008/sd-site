import { RpcTransportError, RpcContractError } from '@/lib/rpc'

export type AppErrorKind = 'transport' | 'contract' | 'render' | 'unknown'

export interface AppError {
  kind: AppErrorKind
  name: string
  message: string
  rpc?: string
  status?: number
  method?: string
  path?: string
}

/**
 * Normalise any thrown value into a render-ready AppError. Supabase RPCs are
 * POSTs to /rest/v1/rpc/<fn>; the PostgrestError cause does not reliably carry
 * a numeric HTTP status, so `status` is best-effort (undefined when absent) —
 * method + path + message still make a bug report actionable.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof RpcTransportError) {
    const cause = err.cause as { status?: unknown } | null | undefined
    const status = typeof cause?.status === 'number' ? cause.status : undefined
    return {
      kind: 'transport',
      name: 'RpcTransportError',
      message: err.message,
      rpc: err.rpc,
      status,
      method: 'POST',
      path: `/rest/v1/rpc/${err.rpc}`,
    }
  }
  if (err instanceof RpcContractError) {
    return {
      kind: 'contract',
      name: 'RpcContractError',
      message: `Unexpected response from ${err.rpc}`,
      rpc: err.rpc,
    }
  }
  if (err instanceof Error) {
    return { kind: 'render', name: err.name || 'Error', message: err.message }
  }
  return { kind: 'unknown', name: 'UnknownError', message: String(err) }
}
