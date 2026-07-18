import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlaceSuggestionT } from '@shared/rpc-contracts'
import { useSearchPlaces } from '../hooks'

interface Props {
  label: string
  value: PlaceSuggestionT | null
  onChange: (place: PlaceSuggestionT | null) => void
  /** Free text to seed the input with (e.g. the current profile city name). */
  initialText?: string
  labelClassName?: string
  inputClassName?: string
  listClassName?: string
  optionClassName?: string
}

export function PlaceCombobox({
  label,
  value,
  onChange,
  initialText,
  labelClassName = '',
  inputClassName = 'border p-2 rounded',
  listClassName = 'border rounded divide-y bg-white',
  optionClassName = 'w-full text-left p-2 hover:bg-slate-100',
}: Props) {
  const { t } = useTranslation('common')
  const [input, setInput] = useState(initialText ?? value?.display_name ?? '')
  const [query, setQuery] = useState('')

  // Debounce: fire the search RPC 250ms after the user stops typing.
  useEffect(() => {
    const id = setTimeout(() => setQuery(input.trim()), 250)
    return () => clearTimeout(id)
  }, [input])

  const search = useSearchPlaces(value ? '' : query)
  const suggestions = search.data?.ok ? search.data.places : []
  const listOpen = !value && query.length >= 2

  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClassName}>{label}</span>
      <input
        className={inputClassName}
        type="text"
        role="combobox"
        aria-expanded={listOpen && suggestions.length > 0}
        aria-controls="place-options"
        aria-autocomplete="list"
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          onChange(null)
        }}
      />
      {listOpen && (
        <ul id="place-options" role="listbox" className={listClassName}>
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className={optionClassName}
                onClick={() => {
                  onChange(p)
                  setInput(p.display_name)
                }}
              >
                {p.display_name}
              </button>
            </li>
          ))}
          {search.isSuccess && suggestions.length === 0 && (
            <li className="p-2 text-sm opacity-70">{t('places.noResults')}</li>
          )}
        </ul>
      )}
      {search.isError && (
        <div role="alert" className="text-sm text-red-700">
          {t('places.searchError')}{' '}
          {search.error instanceof Error
            ? `${search.error.name}: ${search.error.message}`
            : null}
        </div>
      )}
    </label>
  )
}
