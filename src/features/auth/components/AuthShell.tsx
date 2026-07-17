import { Link } from 'react-router'
import type { ReactNode } from 'react'

/** Shared field/button styles for auth forms on the ink background. */
export const authInput =
  'rounded-xl border border-bone/20 bg-white/5 p-3 text-bone ' +
  'focus:border-champagne focus:outline-none'
export const authLabel = 'text-sm text-bone/80'
export const authError = 'text-sm text-red-400'
export const authSubmit =
  'rounded-full py-3 font-semibold text-ink transition-colors disabled:opacity-60 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

/**
 * AuthShell: the Tacit-branded frame for signup/login/forgot pages, so the
 * jump from the landing page doesn't land on an unbranded scaffold form.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ink text-bone font-sans min-h-screen">
      <header className="mx-auto max-w-6xl px-5 py-5 md:px-8">
        <Link
          to="/"
          className="font-display text-lg font-semibold tracking-[0.35em] text-bone"
        >
          TACIT
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md px-5 pt-8 pb-16">{children}</main>
    </div>
  )
}
