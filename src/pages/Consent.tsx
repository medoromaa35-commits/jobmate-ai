import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { CONSENTS, type ConsentKey } from '../content/consents'
import { CONSENT_VERSION } from '../config'
import { emptyConsent, hasRequired, loadConsent, saveConsent, type ConsentState } from '../lib/consentStore'
import { Alert } from '../components/ui'

export default function Consent() {
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const [state, setState] = useState<ConsentState>(() => loadConsent() ?? emptyConsent())
  const [tried, setTried] = useState(false)

  const toggle = (k: ConsentKey) =>
    setState((s) => {
      const granted = !s[k].granted
      return { ...s, [k]: { granted, at: new Date().toISOString(), lang } }
    })

  const ok = hasRequired(state)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!ok) return
    saveConsent(state)
    nav('/apply')
  }

  const group = (required: boolean) => (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
        {required ? t.consent.groupRequired : t.consent.groupOptional}
      </legend>
      {CONSENTS.filter((c) => c.required === required).map((c) => {
        const on = state[c.key].granted
        const missing = tried && c.required && !on
        return (
          <label key={c.key}
            className={`card flex cursor-pointer gap-4 p-4 transition ${on ? 'ring-2 ring-brand-600 bg-brand-50/50' : ''} ${missing ? 'ring-2 ring-danger' : ''}`}>
            <input type="checkbox" checked={on} onChange={() => toggle(c.key)}
              aria-describedby={`c-${c.key}-d`}
              className="mt-1 h-5 w-5 shrink-0 accent-brand-700" />
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.title[lang]}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.required ? 'bg-brand-800 text-white' : 'bg-line text-muted'}`}>
                  {c.required ? t.consent.required : t.consent.optional}
                </span>
              </span>
              <span id={`c-${c.key}-d`} className="mt-1 block text-[15px] text-muted">{c.explain[lang]}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )

  return (
    <div className="section max-w-2xl py-10">
      <p className="text-sm font-semibold text-brand-600">{t.consent.step}</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold">{t.consent.title}</h1>
      <p className="mt-2 text-muted">{t.consent.sub}</p>

      <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
        {group(true)}
        {group(false)}
        {tried && !ok && <Alert tone="danger">{t.consent.missing}</Alert>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Link to="/" className="btn-ghost">{t.consent.back}</Link>
          <button type="submit" className="btn-primary sm:min-w-56">{t.consent.continue}</button>
        </div>
        <p className="text-xs text-muted">
          {t.consent.version(CONSENT_VERSION)} · <Link to="/privacy" className="underline">{t.consent.readPolicy}</Link>
        </p>
      </form>
    </div>
  )
}
