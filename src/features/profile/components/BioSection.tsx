import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { EditableSection } from './EditableSection'
import { useSetBio } from '../hooks'

interface Props {
  tagline: string | null
  about: string | null
  wants: string | null
}

export function BioSection(props: Props) {
  const { t } = useTranslation('profile')
  const setBio = useSetBio()

  return (
    <EditableSection
      title={t('section.bio.title')}
      renderView={() => (
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <div>
            <dt className="font-medium">{t('section.bio.tagline')}</dt>
            <dd>{props.tagline || '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('section.bio.about')}</dt>
            <dd className="whitespace-pre-wrap">{props.about || '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('section.bio.wants')}</dt>
            <dd className="whitespace-pre-wrap">{props.wants || '—'}</dd>
          </div>
        </dl>
      )}
      renderEdit={(close) => <BioForm {...props} onDone={close} setBio={setBio} />}
    />
  )
}

function BioForm({
  tagline,
  about,
  wants,
  onDone,
  setBio,
}: Props & {
  onDone: () => void
  setBio: ReturnType<typeof useSetBio>
}) {
  const { t } = useTranslation('profile')
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: { tagline: tagline ?? '', about: about ?? '', wants: wants ?? '' },
  })

  async function onSubmit(v: { tagline: string; about: string; wants: string }) {
    await setBio.mutateAsync({
      tagline: v.tagline.trim() === '' ? null : v.tagline.trim(),
      about: v.about.trim() === '' ? null : v.about,
      wants: v.wants.trim() === '' ? null : v.wants,
    })
    onDone()
  }

  return (
    <form className="flex flex-col gap-2 text-sm" onSubmit={handleSubmit(onSubmit)}>
      <label className="flex flex-col gap-1">
        <span>{t('section.bio.tagline')}</span>
        <input className="border rounded p-2" maxLength={120} {...register('tagline')} />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('section.bio.about')}</span>
        <textarea
          className="border rounded p-2 min-h-[6rem]"
          maxLength={4000}
          {...register('about')}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('section.bio.wants')}</span>
        <textarea
          className="border rounded p-2 min-h-[4rem]"
          maxLength={2000}
          {...register('wants')}
        />
      </label>
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
