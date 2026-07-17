import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { EditableSection } from './EditableSection'
import { useSetDetails } from '../hooks'
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

interface Props {
  height_cm: number | null
  body_type: string | null
  ethnicity: string | null
  hair_color: string | null
  eye_color: string | null
  has_piercings: boolean | null
  has_tattoos: boolean | null
  smoking: string | null
  drinking: string | null
  education: string | null
  yearly_income_band: string | null
  net_worth_band: string | null
}

const orEmpty = <T extends z.ZodTypeAny>(s: T) => z.union([z.literal(''), s.nullable()])

const Schema = z.object({
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

function fmt(v: string | number | boolean | null): string {
  if (v === null) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  return v.replace(/_/g, ' ')
}

export function DetailsSection(props: Props) {
  const { t } = useTranslation('profile')
  const setDetails = useSetDetails()

  return (
    <EditableSection
      title={t('section.details.title')}
      renderView={() => (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="font-medium">{t('section.details.height')}</dt>
          <dd>{props.height_cm == null ? '—' : `${props.height_cm} cm`}</dd>
          <dt className="font-medium">{t('section.details.body_type')}</dt>
          <dd>{fmt(props.body_type)}</dd>
          <dt className="font-medium">{t('section.details.ethnicity')}</dt>
          <dd>{fmt(props.ethnicity)}</dd>
          <dt className="font-medium">{t('section.details.hair_color')}</dt>
          <dd>{fmt(props.hair_color)}</dd>
          <dt className="font-medium">{t('section.details.eye_color')}</dt>
          <dd>{fmt(props.eye_color)}</dd>
          <dt className="font-medium">{t('section.details.piercings')}</dt>
          <dd>{fmt(props.has_piercings)}</dd>
          <dt className="font-medium">{t('section.details.tattoos')}</dt>
          <dd>{fmt(props.has_tattoos)}</dd>
          <dt className="font-medium">{t('section.details.smoking')}</dt>
          <dd>{fmt(props.smoking)}</dd>
          <dt className="font-medium">{t('section.details.drinking')}</dt>
          <dd>{fmt(props.drinking)}</dd>
          <dt className="font-medium">{t('section.details.education')}</dt>
          <dd>{fmt(props.education)}</dd>
          <dt className="font-medium">{t('section.details.yearly_income_band')}</dt>
          <dd>{fmt(props.yearly_income_band)}</dd>
          <dt className="font-medium">{t('section.details.net_worth_band')}</dt>
          <dd>{fmt(props.net_worth_band)}</dd>
        </dl>
      )}
      renderEdit={(close) => (
        <DetailsForm {...props} onDone={close} setDetails={setDetails} />
      )}
    />
  )
}

function DetailsForm({
  onDone,
  setDetails,
  ...props
}: Props & {
  onDone: () => void
  setDetails: ReturnType<typeof useSetDetails>
}) {
  const { t } = useTranslation('profile')
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: {
      height_cm: props.height_cm,
      body_type: (props.body_type ?? null) as FormData['body_type'],
      ethnicity: (props.ethnicity ?? null) as FormData['ethnicity'],
      hair_color: (props.hair_color ?? null) as FormData['hair_color'],
      eye_color: (props.eye_color ?? null) as FormData['eye_color'],
      has_piercings: props.has_piercings,
      has_tattoos: props.has_tattoos,
      smoking: (props.smoking ?? null) as FormData['smoking'],
      drinking: (props.drinking ?? null) as FormData['drinking'],
      education: (props.education ?? null) as FormData['education'],
      yearly_income_band: (props.yearly_income_band ?? null) as FormData['yearly_income_band'],
      net_worth_band: (props.net_worth_band ?? null) as FormData['net_worth_band'],
    },
  })

  async function onSubmit(values: FormData) {
    await setDetails.mutateAsync({
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
    onDone()
  }

  return (
    <form className="flex flex-col gap-3 text-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('section.details.height')}</span>
        <input
          type="number"
          min={120}
          max={240}
          className="border p-2 rounded"
          {...register('height_cm', {
            setValueAs: (v) =>
              v === '' || v === null || v === undefined ? null : Number(v),
          })}
        />
      </label>

      <EnumSelect
        name="body_type"
        label={t('section.details.body_type')}
        options={['slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular']}
        register={register}
      />
      <EnumSelect
        name="ethnicity"
        label={t('section.details.ethnicity')}
        options={['white', 'black', 'asian', 'hispanic', 'other']}
        register={register}
        renderLabel={(v) => t(`option.ethnicity.${v}`)}
      />
      <EnumSelect
        name="hair_color"
        label={t('section.details.hair_color')}
        options={['black', 'brown', 'blonde', 'red', 'grey', 'other']}
        register={register}
      />
      <EnumSelect
        name="eye_color"
        label={t('section.details.eye_color')}
        options={['brown', 'blue', 'green', 'hazel', 'grey', 'other']}
        register={register}
      />
      <CheckboxField
        name="has_piercings"
        label={t('section.details.piercings')}
        register={register}
      />
      <CheckboxField
        name="has_tattoos"
        label={t('section.details.tattoos')}
        register={register}
      />
      <EnumSelect
        name="smoking"
        label={t('section.details.smoking')}
        options={['never', 'occasionally', 'regularly', 'prefer_not_to_say']}
        register={register}
      />
      <EnumSelect
        name="drinking"
        label={t('section.details.drinking')}
        options={['never', 'socially', 'regularly', 'prefer_not_to_say']}
        register={register}
      />
      <EnumSelect
        name="education"
        label={t('section.details.education')}
        options={['high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'other']}
        register={register}
      />
      <EnumSelect
        name="yearly_income_band"
        label={t('section.details.yearly_income_band')}
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
        label={t('section.details.net_worth_band')}
        options={['under_250k', '250k_1m', '1m_5m', '5m_25m', 'over_25m', 'prefer_not_to_say']}
        register={register}
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-slate-800 text-white px-3 py-1 rounded"
        >
          {t('edit.save')}
        </button>
        <button type="button" onClick={onDone} className="underline">
          {t('edit.cancel')}
        </button>
      </div>
    </form>
  )
}

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
      <select className="border p-2 rounded" {...register(name)}>
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
