export interface SignupAttemptInput {
  role: 'benefactor' | 'baby'
  city: string
  age: number | null
  /** UTM/ref source captured from the signup URL; null when absent. */
  acquisition_source: string | null
}

/**
 * Records a signup ATTEMPT (non-sensitive fields only) for marketing
 * intelligence — including attempts that never complete. Fire-and-forget:
 * must never throw into the signup flow. The signup-attempt-capture plan
 * replaces this body with a Postgres insert via an anonymous-allowed path.
 * Ethnicity/body-type are special-category data and MUST NOT be passed here.
 */
export function recordSignupAttempt(input: SignupAttemptInput): void {
  if (import.meta.env.DEV) console.debug('[signup-attempt]', input)
}
