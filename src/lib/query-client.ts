import { QueryClient } from '@tanstack/react-query'

// Defaults tuned for the SD Site profile: short stale times (we don't have realtime),
// no auto-refetch on window focus during onboarding (would clobber form state),
// retry once on transient network errors.
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
