import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Initialise Sentry for error reporting only (OTel owns tracing).
 * Env-gated: no-op unless VITE_SENTRY_DSN is set — dev/tests/local stay off.
 * No ambient default to production. sendDefaultPii is intentionally true and
 * there is no beforeSend scrubbing (deliberate product decision).
 */
export function initSentry(): void {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined,
    release: import.meta.env.VITE_BUILD_ID as string | undefined,
    sendDefaultPii: true,
    tracesSampleRate: 0,
    integrations: [],
  })
  initialized = true
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

/** Test-only: reset the module init flag between tests. */
export function __resetSentryForTest(): void {
  initialized = false
}
