import type { z } from 'zod'
import type { ProfileRole } from '@shared/rpc-contracts'

export type OnboardingStep =
  | 'role' | 'identity' | 'photo' | 'bio' | 'details' | 'interests' | 'complete'

type Role = z.infer<typeof ProfileRole>

const BENEFACTOR_STEPS: OnboardingStep[] = ['role', 'identity', 'photo', 'complete']
const BABY_STEPS: OnboardingStep[] = [
  'role', 'identity', 'photo', 'bio', 'details', 'interests', 'complete',
]

export function stepsForRole(role: Role): OnboardingStep[] {
  return role === 'baby' ? BABY_STEPS : BENEFACTOR_STEPS
}

export function nextStepPath(role: Role, current: OnboardingStep): string {
  const seq = stepsForRole(role)
  const idx = seq.indexOf(current)
  if (idx === -1) return '/onboarding/complete'
  const next = seq[idx + 1] ?? 'complete'
  return `/onboarding/${next}`
}
