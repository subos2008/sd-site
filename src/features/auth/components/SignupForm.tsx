import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { BodyType, Ethnicity, PlaceSuggestionT } from '@shared/rpc-contracts'
import { signUp } from '../api'
import { recordSignupAttempt } from '@/features/signup-attempt/api'
import { authError, authInput, authLabel, authSubmit } from './AuthShell'
import { ChipSelect } from './ChipSelect'
import { PlaceCombobox } from '@/features/places/components/PlaceCombobox'

type BodyTypeValue = z.infer<typeof BodyType>
type EthnicityValue = z.infer<typeof Ethnicity>

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
type FormData = z.infer<typeof Schema>

export function SignupForm({
  onSuccess,
  roleHint,
  acquisitionSource,
}: {
  onSuccess?: () => void
  roleHint?: 'benefactor' | 'baby'
  acquisitionSource?: string | null
}) {
  const { t } = useTranslation('auth')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })
  const [username, setUsername] = useState('')
  const [place, setPlace] = useState<PlaceSuggestionT | null>(null)
  const [age, setAge] = useState('')
  const [bodyType, setBodyType] = useState<BodyTypeValue | null>(null)
  const [ethnicity, setEthnicity] = useState<EthnicityValue | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const ageNum = age.trim() === '' ? null : Number(age)
  const under18 = ageNum != null && !Number.isNaN(ageNum) && ageNum < 18

  const chipAccent = roleHint === 'baby' ? 'bg-rose text-ink' : 'bg-champagne text-ink'

  const bodyTypeOptions: readonly { value: BodyTypeValue; label: string }[] = [
    { value: 'slim', label: t('bodyType.slim') },
    { value: 'athletic', label: t('bodyType.fit') },
    { value: 'average', label: t('bodyType.average') },
    { value: 'curvy', label: t('bodyType.curvy') },
    { value: 'plus_size', label: t('bodyType.fullFigured') },
    { value: 'muscular', label: t('bodyType.muscular') },
  ]
  const ethnicityOptions: readonly { value: EthnicityValue; label: string }[] = [
    { value: 'white', label: t('ethnicity.white') },
    { value: 'black', label: t('ethnicity.black') },
    { value: 'asian', label: t('ethnicity.asian') },
    { value: 'hispanic', label: t('ethnicity.hispanic') },
    { value: 'other', label: t('ethnicity.other') },
  ]

  async function onSubmit(values: FormData) {
    setServerError(null)
    if (under18 || !place) return
    try {
      if (roleHint) {
        // Non-sensitive marketing signal — never ethnicity/body_type here.
        recordSignupAttempt({
          role: roleHint,
          city: place.name,
          age: ageNum != null && !Number.isNaN(ageNum) ? ageNum : null,
          acquisition_source: acquisitionSource ?? null,
        })
      }
      await signUp(values.email, values.password, {
        role: roleHint,
        username: username.trim() || undefined,
        city: place.name,
        place_id: place.id,
        age: ageNum != null && !Number.isNaN(ageNum) ? ageNum : undefined,
        body_type: bodyType ?? undefined,
        ethnicity: ethnicity ?? undefined,
      })
      setDone(true)
      onSuccess?.()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  if (done) return <p className="mt-6 text-bone/80">{t('signup.checkEmail')}</p>

  const submitAccent = roleHint === 'baby' ? 'bg-rose hover:bg-bone' : 'bg-champagne hover:bg-bone'

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('signup.email')}</span>
        <input
          className={authInput}
          type="email"
          placeholder={t('signup.emailPlaceholder')}
          {...register('email')}
        />
        {errors.email && <span className={authError}>{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('signup.username')}</span>
        <input
          className={authInput}
          type="text"
          placeholder={t('signup.usernamePlaceholder')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('signup.password')}</span>
        <input
          className={authInput}
          type="password"
          placeholder={t('signup.passwordPlaceholder')}
          {...register('password')}
        />
        {errors.password && <span className={authError}>{errors.password.message}</span>}
      </label>
      <PlaceCombobox
        label={t('signup.city')}
        value={place}
        onChange={setPlace}
        labelClassName={authLabel}
        inputClassName={authInput}
        listClassName="rounded-xl border border-bone/20 bg-ink/95 divide-y divide-bone/10"
        optionClassName="w-full text-left p-2 text-bone hover:bg-bone/10"
      />
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>{t('signup.age')}</span>
        <input
          className={authInput}
          type="number"
          min={18}
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        {under18 && <span className={authError}>{t('signup.under18')}</span>}
      </label>

      {roleHint === 'baby' && (
        <ChipSelect
          label={t('signup.bodyType')}
          options={bodyTypeOptions}
          value={bodyType}
          onChange={setBodyType}
          accent={chipAccent}
        />
      )}
      <ChipSelect
        label={t('signup.ethnicity')}
        options={ethnicityOptions}
        value={ethnicity}
        onChange={setEthnicity}
        accent={chipAccent}
      />

      {serverError && (
        <div role="alert" className={authError}>
          {serverError}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting || under18 || !place}
        className={`${authSubmit} ${submitAccent} mt-2`}
      >
        {t('signup.submit')}
      </button>
      <p className="text-xs leading-relaxed text-bone/60">
        {t('signup.certifyPre')}
        <Link to="/legal/privacy" className="underline hover:text-bone">
          {t('signup.privacyPolicy')}
        </Link>
        {t('signup.certifyMid')}
        <Link to="/legal/terms" className="underline hover:text-bone">
          {t('signup.terms')}
        </Link>
        {t('signup.certifyPost')}
      </p>
    </form>
  )
}
