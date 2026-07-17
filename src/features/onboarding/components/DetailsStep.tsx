import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSetDetails, useMyProfile } from '../hooks'
import { nextStepPath } from '../steps'
import {
  BodyType,
  Ethnicity,
  HairColor,
  EyeColor,
  Smoking,
  Drinking,
  Education,
  IncomeBand,
  NetWorthBand,
} from '@shared/rpc-contracts'

// Use a union with empty string so React Hook Form's select default ("") validates,
// and we normalise to null inside onSubmit.
const orEmpty = <T extends z.ZodTypeAny>(s: T) => z.union([z.literal(''), s.nullable()])

const Schema = z.object({
  // height_cm is normalised by RHF's setValueAs to number | null before validation.
  height_cm: z.number().int().min(120).max(240).nullable(),
  body_type: orEmpty(BodyType),
  ethnicity: orEmpty(Ethnicity),
  hair_color: orEmpty(HairColor),
  eye_color: orEmpty(EyeColor),
  has_piercings: z.boolean().nullable(),
  has_tattoos: z.boolean().nullable(),
  smoking: orEmpty(Smoking),
  drinking: orEmpty(Drinking),
  education: orEmpty(Education),
  yearly_income_band: orEmpty(IncomeBand),
  net_worth_band: orEmpty(NetWorthBand),
})
type FormData = z.infer<typeof Schema>

function emptyToNull<T extends string>(v: T | '' | null): T | null {
  return v === '' || v === null ? null : v
}

const emptyDefaults: FormData = {
  height_cm: null,
  body_type: null,
  ethnicity: null,
  hair_color: null,
  eye_color: null,
  has_piercings: null,
  has_tattoos: null,
  smoking: null,
  drinking: null,
  education: null,
  yearly_income_band: null,
  net_worth_band: null,
}

export function DetailsStep() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setDetails = useSetDetails()
  const { data: me } = useMyProfile()
  const role = me?.ok ? me.profile.role : null
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (role === 'benefactor') navigate(nextStepPath('benefactor', 'details'))
  }, [role, navigate])

  // Seed from any bootstrap-committed values (e.g. body_type/ethnicity captured
  // at signup) so they pre-select. Enum nulls become '' to match the selects.
  const seededValues = useMemo<FormData | undefined>(() => {
    if (!me?.ok) return undefined
    const p = me.profile
    return {
      height_cm: p.height_cm,
      body_type: p.body_type ?? '',
      ethnicity: p.ethnicity ?? '',
      hair_color: p.hair_color ?? '',
      eye_color: p.eye_color ?? '',
      has_piercings: p.has_piercings,
      has_tattoos: p.has_tattoos,
      smoking: p.smoking ?? '',
      drinking: p.drinking ?? '',
      education: p.education ?? '',
      yearly_income_band: p.yearly_income_band ?? '',
      net_worth_band: p.net_worth_band ?? '',
    }
  }, [me])

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: emptyDefaults,
    values: seededValues,
  })

  async function onSubmit(values: FormData) {
    setServerError(null)
    try {
      const res = await setDetails.mutateAsync({
        height_cm: values.height_cm,
        body_type: emptyToNull(values.body_type),
        ethnicity: emptyToNull(values.ethnicity),
        hair_color: emptyToNull(values.hair_color),
        eye_color: emptyToNull(values.eye_color),
        has_piercings: values.has_piercings,
        has_tattoos: values.has_tattoos,
        smoking: emptyToNull(values.smoking),
        drinking: emptyToNull(values.drinking),
        education: emptyToNull(values.education),
        yearly_income_band: emptyToNull(values.yearly_income_band),
        net_worth_band: emptyToNull(values.net_worth_band),
      })
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      navigate(nextStepPath('baby', 'details'))
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'unknown')
    }
  }

  return (
    <form className="flex flex-col gap-3 p-4" onSubmit={handleSubmit(onSubmit)}>
      <h2 className="text-lg font-semibold">{t('details.title')}</h2>
      {serverError && (
        <div role="alert" className="text-red-700">
          {serverError}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span>{t('section.details.height', { ns: 'profile' })}</span>
        <input
          type="number"
          min={120}
          max={240}
          className="border p-2 rounded"
          {...register('height_cm', {
            setValueAs: (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
          })}
        />
      </label>

      <EnumSelect
        name="body_type"
        label={t('section.details.body_type', { ns: 'profile' })}
        options={['slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular']}
        register={register}
        renderLabel={(v) => t(`option.body_type.${v}`, { ns: 'profile' })}
      />
      <EnumSelect
        name="ethnicity"
        label={t('section.details.ethnicity', { ns: 'profile' })}
        options={['white', 'black', 'asian', 'hispanic', 'other']}
        register={register}
        renderLabel={(v) => t(`option.ethnicity.${v}`, { ns: 'profile' })}
      />
      <EnumSelect
        name="hair_color"
        label={t('section.details.hair_color', { ns: 'profile' })}
        options={['black', 'brown', 'blonde', 'red', 'grey', 'other']}
        register={register}
      />
      <EnumSelect
        name="eye_color"
        label={t('section.details.eye_color', { ns: 'profile' })}
        options={['brown', 'blue', 'green', 'hazel', 'grey', 'other']}
        register={register}
      />
      <CheckboxField
        name="has_piercings"
        label={t('section.details.piercings', { ns: 'profile' })}
        register={register}
      />
      <CheckboxField
        name="has_tattoos"
        label={t('section.details.tattoos', { ns: 'profile' })}
        register={register}
      />
      <EnumSelect
        name="smoking"
        label={t('section.details.smoking', { ns: 'profile' })}
        options={['never', 'occasionally', 'regularly', 'prefer_not_to_say']}
        register={register}
      />
      <EnumSelect
        name="drinking"
        label={t('section.details.drinking', { ns: 'profile' })}
        options={['never', 'socially', 'regularly', 'prefer_not_to_say']}
        register={register}
      />
      <EnumSelect
        name="education"
        label={t('section.details.education', { ns: 'profile' })}
        options={['high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'other']}
        register={register}
      />
      <EnumSelect
        name="yearly_income_band"
        label={t('section.details.yearly_income_band', { ns: 'profile' })}
        options={[
          'under_50k',
          '50_100k',
          '100_250k',
          '250_500k',
          '500k_1m',
          'over_1m',
          'prefer_not_to_say',
        ]}
        register={register}
      />
      <EnumSelect
        name="net_worth_band"
        label={t('section.details.net_worth_band', { ns: 'profile' })}
        options={['under_250k', '250k_1m', '1m_5m', '5m_25m', 'over_25m', 'prefer_not_to_say']}
        register={register}
      />

      <div className="flex justify-between mt-4">
        <button
          type="button"
          onClick={() => navigate(nextStepPath('baby', 'details'))}
          className="underline"
        >
          {t('details.skip')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-slate-800 text-white px-4 py-2 rounded"
        >
          {t('details.continue')}
        </button>
      </div>
    </form>
  )
}

// Tiny helpers — keep them in this file (they're not reused elsewhere yet).
function EnumSelect({
  name,
  label,
  options,
  register,
  renderLabel,
}: {
  name: keyof FormData
  label: string
  options: readonly string[]
  register: ReturnType<typeof useForm<FormData>>['register']
  renderLabel?: (v: string) => string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <select className="border p-2 rounded" {...register(name)} defaultValue="">
        <option value="">—</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {renderLabel ? renderLabel(v) : v.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckboxField({
  name,
  label,
  register,
}: {
  name: keyof FormData
  label: string
  register: ReturnType<typeof useForm<FormData>>['register']
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" {...register(name)} />
      <span>{label}</span>
    </label>
  )
}
