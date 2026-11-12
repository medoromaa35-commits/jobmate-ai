import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18n'
import type { Option } from '../content/options'

export function Field({ id, label, hint, error, optional, children }: {
  id: string; label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label} {optional && <span className="font-normal text-muted text-sm">{t.form.optional}</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="field-error">{error}</p>}
    </div>
  )
}

/** Accessible chip group used for multi- or single-select. */
export function ChipGroup({ name, legend, options, value, onChange, multiple, error, hint }: {
  name: string; legend: string; options: Option[]; value: string[]; onChange: (v: string[]) => void
  multiple?: boolean; error?: string; hint?: string
}) {
  const { lang } = useI18n()
  return (
    <fieldset aria-describedby={error ? `${name}-err` : undefined}>
      <legend className="field-label">{legend}</legend>
      {hint && <p className="field-hint -mt-1 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <label key={o.value} className={`chip ${on ? 'chip-on' : ''}`}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={o.value}
                checked={on}
                onChange={() =>
                  onChange(multiple ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])
                }
                className="sr-only"
              />
              {multiple && (
                <span aria-hidden="true" className={`grid h-4 w-4 place-items-center rounded border ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-muted/50'}`}>
                  {on && <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
                </span>
              )}
              <span>{o[lang]}</span>
            </label>
          )
        })}
      </div>
      {error && <p id={`${name}-err`} role="alert" className="field-error">{error}</p>}
    </fieldset>
  )
}

export function Select({ id, options, value, onChange, invalid }: {
  id: string; options: Option[]; value: string; onChange: (v: string) => void; invalid?: boolean
}) {
  const { lang, t } = useI18n()
  return (
    <select id={id} className="input appearance-auto" value={value} aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>{t.form.selectPlaceholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o[lang]}</option>)}
    </select>
  )
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'danger'; title?: string; children: ReactNode }) {
  const styles = {
    info: 'bg-brand-50 text-brand-800 ring-brand-100',
    warn: 'bg-warn-50 text-warn-700 ring-accent/50',
    danger: 'bg-danger-50 text-danger ring-danger/20',
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={`rounded-xl p-4 ring-1 text-[15px] ${styles}`}>
      {title && <p className="font-bold mb-1">{title}</p>}
      <div>{children}</div>
    </div>
  )
}

export function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
}
