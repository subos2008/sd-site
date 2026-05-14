import type { ZodTypeAny, z } from 'zod'
import { supabase } from './supabase'

export class RpcContractError extends Error {
  rpc: string
  issues: unknown
  constructor(rpc: string, issues: unknown) {
    super(`RPC contract violation for ${rpc}`)
    this.rpc = rpc
    this.issues = issues
  }
}

export class RpcTransportError extends Error {
  rpc: string
  cause: unknown
  constructor(rpc: string, cause: unknown) {
    super(`RPC transport error for ${rpc}: ${String(cause)}`)
    this.rpc = rpc
    this.cause = cause
  }
}

/**
 * Call a Supabase Postgres RPC and `.parse()` the response through the provided
 * Zod schema. Throws RpcTransportError if Supabase reports an error; throws
 * RpcContractError if the response shape disagrees with the schema (catches
 * mock drift and backend drift in one place).
 */
export async function callRpc<TSchema extends ZodTypeAny>(
  fn: string,
  args: Record<string, unknown>,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, args as any)
  if (error) throw new RpcTransportError(fn, error)
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new RpcContractError(fn, parsed.error.issues)
  return parsed.data
}
