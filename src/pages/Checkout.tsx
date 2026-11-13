import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { Alert, Field, Spinner } from '../components/ui'
import { isEmail, normalizeEgyptMobile } from '../lib/validation'
import { supabase } from '../lib/supabase'
import { PILOT_PRICE_EGP } from '../config'

// No merchant account yet (PAYMENT_PROVIDER = null): we record an order request and the
// team sends a secure payment link. When Paymob/Kashier is integrated, this page will
// redirect to the provider's hosted checkout instead.
export default function Checkout() {
  const { t, lang } = useI18n()
  const C = t.checkout
  const [f, setF] = useState({ full_name: '', email: '', mobile: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({})
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFail(null)
    const errs: typeof errors = {}
    if (f.full_name.trim().length < 2) errs.full_name = t.errors.name
    if (!isEmail(f.email)) errs.email = t.errors.email
    const mobile = normalizeEgyptMobile(f.mobile)
    if (!mobile) errs.mobile = t.errors.mobile
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (!supabase) { setFail(t.errors.notConfigured); return }
    setBusy(true)
    const { error } = await supabase.from('orders').insert({
      plan: 'pilot_sprint',
      price_shown: String(PILOT_PRICE_EGP),
      full_name: f.full_name.trim(),
      email: f.email.trim().toLowerCase(),
      mobile,
      language: lang,
    })
    setBusy(false)
    if (error) { console.error(error); setFail(t.errors.generic); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="section max-w-xl py-12">
        <div className="card p-6 sm:p-8 text-center" role="status">
          <span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-700">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <h1 className="mt-4 text-2xl font-bold">{C.doneTitle}</h1>
          <p className="mt-2 text-muted">{C.done}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/consent" className="btn-primary">{C.applyNow}</Link>
            <Link to="/" className="btn-ghost">{C.home}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section max-w-xl py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">{C.title}</h1>
      <p className="mt-2 text-muted">{C.sub}</p>
      <div className="mt-6 card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted">{C.plan}</p>
          <p className="font-bold">{t.pricing.plan} · {t.pricing.duration}</p>
        </div>
        <p className="text-xl font-bold text-brand-800">{t.pricing.price(String(PILOT_PRICE_EGP))}</p>
      </div>
      <form onSubmit={submit} noValidate className="mt-4 card p-5 sm:p-7 space-y-5">
        <Field id="co-name" label={C.fullName} error={errors.full_name}>
          <input id="co-name" className="input" autoComplete="name" value={f.full_name} maxLength={120}
            aria-invalid={errors.full_name ? true : undefined} onChange={(e) => set('full_name', e.target.value)} />
        </Field>
        <Field id="co-email" label={C.email} error={errors.email}>
          <input id="co-email" type="email" inputMode="email" autoComplete="email" className="input" value={f.email} maxLength={254}
            aria-invalid={errors.email ? true : undefined} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field id="co-mobile" label={C.mobile} hint={t.form.mobileHint} error={errors.mobile}>
          <input id="co-mobile" type="tel" inputMode="tel" autoComplete="tel" className="input" value={f.mobile} maxLength={20}
            placeholder="01012345678" aria-invalid={errors.mobile ? true : undefined} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <p className="flex gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          {C.note}
        </p>
        {fail && <Alert tone="danger">{fail}</Alert>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy && <Spinner />}{busy ? C.sending : C.submit}</button>
      </form>
    </div>
  )
}
