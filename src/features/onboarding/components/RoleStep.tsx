import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ProfileRole } from '@shared/rpc-contracts'
import { useSession } from '@/lib/auth-context'
import { useSetRole } from '../hooks'
import { nextStepPath } from '../steps'

export function RoleStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const { session } = useSession()
  const setRole = useSetRole()
  const [serverError, setServerError] = useState<string | null>(null)

  // A landing-page fork CTA stashes the chosen role in auth user metadata at
  // signup; when present, commit it and skip this step. On any failure the
  // normal chooser renders below.
  const hinted = ProfileRole.safeParse(session?.user?.user_metadata?.role_hint)
  const roleHint = hinted.success ? hinted.data : undefined
  const autoAttempted = useRef(false)

  async function choose(role: 'benefactor' | 'baby') {
    setServerError(null)
    try {
      const res = await setRole.mutateAsync(role)
      if (!res.ok) { setServerError(res.error); return }
      navigate(nextStepPath(role, 'role'))
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  useEffect(() => {
    if (!roleHint || autoAttempted.current) return
    autoAttempted.current = true
    void choose(roleHint)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleHint])

  if (roleHint && !serverError) {
    return <p className="p-4">{t('role.settingUp')}</p>
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('role.title')}</h2>
      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded"
        disabled={setRole.isPending}
        onClick={() => choose('benefactor')}
      >
        {t('role.benefactor')}
      </button>
      <button
        type="button"
        className="bg-slate-800 text-white py-2 rounded"
        disabled={setRole.isPending}
        onClick={() => choose('baby')}
      >
        {t('role.baby')}
      </button>
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}
    </section>
  )
}
