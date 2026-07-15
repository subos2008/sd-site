import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSetRole } from '../hooks'
import { nextStepPath } from '../steps'

export function RoleStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setRole = useSetRole()
  const [serverError, setServerError] = useState<string | null>(null)

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
