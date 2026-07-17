import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { geocodeCity } from '../geocode'
import { useSetLocation, useMyProfile } from '../hooks'
import { useSession } from '@/lib/auth-context'
import { nextStepPath } from '../steps'

type Resolved = { display_name: string; lat: number; lng: number }

export function LocationStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setLocation = useSetLocation()
  const { data: me } = useMyProfile()
  const role = me?.ok ? me.profile.role : null
  const { session } = useSession()
  const metadataCity =
    typeof session?.user?.user_metadata?.city === 'string'
      ? (session.user.user_metadata.city as string)
      : ''
  const [input, setInput] = useState(metadataCity)
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)

  async function onLookup() {
    setResolved(null)
    setLookupError(null)
    setServerError(null)
    if (input.trim().length < 2) return
    setLooking(true)
    try {
      const res = await geocodeCity(input.trim())
      if (res.ok) {
        setResolved({ display_name: res.display_name, lat: res.lat, lng: res.lng })
      } else {
        setLookupError(t('location.notFound'))
      }
    } catch {
      setLookupError(t('location.notFound'))
    } finally {
      setLooking(false)
    }
  }

  async function onContinue() {
    if (!resolved) return
    setServerError(null)
    try {
      const res = await setLocation.mutateAsync(resolved)
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      navigate(nextStepPath(role ?? 'benefactor', 'location'))
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  return (
    <section className="flex flex-col gap-3 p-4 max-w-sm">
      <h2 className="text-xl">{t('location.title')}</h2>
      <label className="flex flex-col gap-1">
        <span>{t('location.placeName')}</span>
        <input
          className="border p-2 rounded"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="bg-slate-600 text-white py-2 rounded"
        onClick={onLookup}
        disabled={looking || input.trim().length < 2}
      >
        {t('location.lookup')}
      </button>
      {lookupError && (
        <div role="alert" className="text-red-700">
          {lookupError}
        </div>
      )}
      {resolved && (
        <>
          <p className="text-sm">{resolved.display_name}</p>
          <button
            type="button"
            className="bg-slate-800 text-white py-2 rounded"
            onClick={onContinue}
            disabled={setLocation.isPending}
          >
            {t('location.continue')}
          </button>
        </>
      )}
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}
    </section>
  )
}
