import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toAppError } from './errors/app-error'
import { reportError } from './errors/error-bus'
import { captureError } from './errors/sentry'

function surfaceError(error: unknown, meta: Record<string, unknown> | undefined): void {
  if (meta?.suppressGlobalError === true) return
  const appError = toAppError(error)
  captureError(error, { kind: appError.kind, rpc: appError.rpc, status: appError.status })
  reportError(appError)
}

// Defaults tuned for the SD Site profile: short stale times (we don't have realtime),
// retry once on transient network errors. QueryCache/MutationCache onError form the
// global error surface — every error is shown + reported unless a query/mutation opts
// out via meta.suppressGlobalError (components that surface the error inline themselves).
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => surfaceError(error, query.meta),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => surfaceError(error, mutation.meta),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
