export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  accent,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  accent: string // e.g. 'bg-rose text-ink' when selected
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm text-bone/80">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                selected ? `${accent} border-transparent` : 'border-bone/20 text-bone/80 hover:border-bone/50'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
