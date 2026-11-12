import { useState } from 'react'
import { useI18n } from '../i18n/I18n'
import { Alert, Field, Spinner } from '../components/ui'
import { isEmail } from '../lib/validation'
import { supabase } from '../lib/supabase'

export default function DeleteData() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [fail, setFail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFail(null)
    if (!isEmail(email)) { setErr(t.errors.email); return }
    if (!supabase) { setFail(t.errors.notConfigured); return }
    setBusy(true)
    // Insert only — the public can't read deletion requests back.
    const { error } = await supabase.from('deletion_requests').insert({
      email: email.trim().toLowerCase(),
      reason: reason.trim() || null,
    })
    setBusy(false)
    if (error) { console.error(error); setFail(t.errors.generic); return }
    setDone(true)
  }

  return (
    <div className="section max-w-xl py-12">
      <h1 className="text-2xl sm:text-3xl font-bold">{t.del.title}</h1>
      {done ? (
        <div className="mt-6 card p-6" role="status">
          <h2 className="text-xl font-bold">{t.del.doneTitle}</h2>
          <p className="mt-2 text-muted">{t.del.done}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-muted">{t.del.sub}</p>
          <form onSubmit={submit} noValidate className="mt-6 card p-5 sm:p-7 space-y-5">
            <Field id="del-email" label={t.del.email} error={err ?? undefined}>
              <input id="del-email" type="email" inputMode="email" autoComplete="email" className="input" value={email}
                aria-invalid={err ? true : undefined} aria-describedby={err ? 'del-email-err' : undefined}
                onChange={(e) => { setEmail(e.target.value); setErr(null) }} maxLength={254} />
            </Field>
            <Field id="del-reason" label={t.del.reason} hint={t.del.reasonHint} optional>
              <textarea id="del-reason" className="input min-h-28" value={reason} maxLength={1000}
                aria-describedby="del-reason-hint" onChange={(e) => setReason(e.target.value)} />
            </Field>
            {fail && <Alert tone="danger">{fail}</Alert>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy && <Spinner />}{busy ? t.del.sending : t.del.submit}
            </button>
            <p className="text-sm text-muted">{t.del.note}</p>
          </form>
        </>
      )}
    </div>
  )
}
