import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { CV_BUCKET, supabase } from '../../lib/supabase'
import { useI18n } from '../../i18n/I18n'
import { LangToggle, Logo } from '../../components/Layout'
import { Alert, Spinner } from '../../components/ui'
import {
  APPS_LAST_MONTH, COMMUTE, HEARD_FROM, LOCATIONS, SALARY_RANGES, STATUSES, TARGET_ROLES, WILLING_TO_PAY, WORK_MODES,
  label, type Lang, type Option, type Status,
} from '../../content/options'
import { ADMIN_STRINGS, type AdminDict } from './adminStrings'
import { downloadCsv } from './csv'

export type Applicant = {
  id: string; created_at: string; updated_at: string; status: Status; language: Lang
  full_name: string; email: string; mobile: string
  current_job_title: string; years_experience: number; current_industry: string
  target_roles: string[]; preferred_locations: string[]; preferred_location_other: string | null
  max_commute_minutes: number; work_modes: string[]; min_salary_range: string
  cv_path: string; linkedin_url: string | null
  applications_last_month: string; willing_to_pay: string; fair_price_egp: number | null
  heard_from: string; heard_from_other: string | null; price_shown_egp: string | null
}
type ConsentRow = { consent_key: string; granted: boolean; required: boolean; consent_version: string; consent_text: string; language: string; granted_at: string; recorded_at: string }
type NoteRow = { id: number; note: string; author_email: string | null; created_at: string }
type DeletionRow = { id: string; created_at: string; email: string | null; reason: string | null; status: string; completed_at: string | null; deleted_applicants: number | null }

const STATUS_STYLE: Record<Status, string> = {
  new: 'bg-sky-50 text-sky-800 ring-sky-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  waitlist: 'bg-amber-50 text-amber-800 ring-amber-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  active: 'bg-brand-50 text-brand-800 ring-brand-100',
  done: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
}

const fmtDate = (s: string, lang: Lang) =>
  new Date(s).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const labels = (opts: Option[], vals: string[] | null, lang: Lang) => (vals ?? []).map((v) => label(opts, v, lang)).join('، ')

function useAdminT(): { a: AdminDict; lang: Lang } {
  const { lang } = useI18n()
  return { a: ADMIN_STRINGS[lang], lang }
}

// ───────────────────────────────── Gate ─────────────────────────────────
export default function Admin() {
  const { a } = useAdminT()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    document.title = 'Admin — JobMate AI'
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) return <Shell><Alert tone="danger">{a.notConfigured}</Alert></Shell>
  if (session === undefined) return <Shell><p className="text-muted">{a.loading}</p></Shell>
  if (!session) return <Shell><Login /></Shell>

  const isAdmin = (session.user.app_metadata as { role?: string })?.role === 'admin'
  if (!isAdmin) {
    return (
      <Shell email={session.user.email}>
        <Alert tone="danger">{a.notAdmin}</Alert>
      </Shell>
    )
  }
  return <Shell email={session.user.email} wide><Dashboard /></Shell>
}

function Shell({ children, email, wide }: { children: React.ReactNode; email?: string; wide?: boolean }) {
  const { a } = useAdminT()
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-white">
        <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-4 ${wide ? 'max-w-7xl' : 'max-w-md'}`}>
          <Link to="/" className="flex items-center gap-2"><Logo /><span className="text-sm font-semibold text-muted">· {a.title}</span></Link>
          <div className="flex items-center gap-2">
            {email && <span className="hidden sm:inline text-sm text-muted ltr">{email}</span>}
            <LangToggle />
            {email && <button className="rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-line hover:bg-brand-50" onClick={() => supabase!.auth.signOut()}>{a.signOut}</button>}
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? 'max-w-7xl' : 'max-w-md'}`}>{children}</main>
    </div>
  )
}

function Login() {
  const { a } = useAdminT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(a.badLogin)
  }
  return (
    <form onSubmit={submit} className="card mt-10 space-y-4 p-6">
      <h1 className="text-xl font-bold">{a.signIn}</h1>
      <div>
        <label htmlFor="ad-email" className="field-label">{a.email}</label>
        <input id="ad-email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="ad-pass" className="field-label">{a.password}</label>
        <input id="ad-pass" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {err && <Alert tone="danger">{err}</Alert>}
      <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />}{busy ? a.signingIn : a.signIn}</button>
    </form>
  )
}

// ─────────────────────────────── Dashboard ───────────────────────────────
function Dashboard() {
  const { a } = useAdminT()
  const [tab, setTab] = useState<'applicants' | 'orders' | 'deletions' | 'stats'>('applicants')
  const [rows, setRows] = useState<Applicant[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    const { data, error } = await supabase!.from('applicants').select('*').order('created_at', { ascending: false })
    if (error) { setErr(error.message); return }
    setRows(data as Applicant[])
  }, [])
  useEffect(() => { void load() }, [load])

  return (
    <>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
        {(['applicants', 'orders', 'deletions', 'stats'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-brand-700 text-brand-800' : 'border-transparent text-muted hover:text-ink'}`}>
            {a.tabs[k]}
          </button>
        ))}
      </div>
      {err && <div className="mt-4"><Alert tone="danger">{err}</Alert></div>}
      <div className="mt-5">
        {tab === 'applicants' && <Applicants rows={rows} reload={load} setRows={setRows} />}
        {tab === 'orders' && <Orders applicants={rows ?? []} />}
        {tab === 'deletions' && <Deletions reload={load} applicants={rows ?? []} />}
        {tab === 'stats' && <Stats rows={rows ?? []} />}
      </div>
    </>
  )
}

// ─────────────────────────────── Applicants ───────────────────────────────
function Applicants({ rows, reload, setRows }: { rows: Applicant[] | null; reload: () => Promise<void>; setRows: (r: Applicant[]) => void }) {
  const { a, lang } = useAdminT()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [loc, setLoc] = useState('')
  const [wtp, setWtp] = useState('')
  const [open, setOpen] = useState<Applicant | null>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (!status || r.status === status) &&
      (!role || r.target_roles.includes(role)) &&
      (!loc || r.preferred_locations.includes(loc)) &&
      (!wtp || r.willing_to_pay === wtp) &&
      (!s || [r.full_name, r.email, r.current_job_title, r.current_industry, r.mobile].some((x) => x?.toLowerCase().includes(s))))
  }, [rows, q, status, role, loc, wtp])

  const updateLocal = (u: Applicant) => setRows((rows ?? []).map((r) => (r.id === u.id ? u : r)))

  const sel = (value: string, set: (v: string) => void, all: string, opts: { value: string; text: string }[], aria: string) => (
    <select aria-label={aria} className="input !min-h-10 !py-2 text-sm" value={value} onChange={(e) => set(e.target.value)}>
      <option value="">{all}</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
    </select>
  )

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto_auto]">
        <input type="search" className="input !min-h-10 !py-2 text-sm" placeholder={a.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={a.search} />
        {sel(status, setStatus, a.allStatuses, STATUSES.map((s) => ({ value: s, text: a.statuses[s] })), a.status)}
        {sel(role, setRole, a.allRoles, TARGET_ROLES.map((o) => ({ value: o.value, text: o[lang] })), a.cols.roles)}
        {sel(loc, setLoc, a.allLocations, LOCATIONS.map((o) => ({ value: o.value, text: o[lang] })), a.cols.loc)}
        {sel(wtp, setWtp, a.allWtp, WILLING_TO_PAY.map((o) => ({ value: o.value, text: o[lang] })), a.cols.wtp)}
        <button className="btn-ghost !min-h-10 !py-2 text-sm" onClick={() => void reload()}>{a.refresh}</button>
        <button className="btn-primary !min-h-10 !py-2 text-sm" disabled={!filtered.length} onClick={() => downloadCsv(filtered, lang)}>{a.exportCsv}</button>
      </div>
      <p className="mt-3 text-sm text-muted">{rows ? a.count(filtered.length, rows.length) : a.loading}</p>

      {rows && !filtered.length && <p className="mt-6 text-center text-muted">{a.empty}</p>}

      {/* Mobile: cards */}
      <ul className="mt-3 space-y-2 md:hidden">
        {filtered.map((r) => (
          <li key={r.id}>
            <button className="card w-full p-4 text-start" onClick={() => setOpen(r)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="text-sm text-muted">{r.current_job_title} · {r.years_experience}y</p>
                </div>
                <StatusPill s={r.status} />
              </div>
              <p className="mt-2 text-xs text-muted">{labels(TARGET_ROLES, r.target_roles, lang)}</p>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="mt-3 hidden overflow-x-auto rounded-xl ring-1 ring-line md:block">
        <table className="w-full bg-white text-sm">
          <thead className="bg-paper text-start text-xs uppercase text-muted">
            <tr>
              {(['created', 'name', 'title', 'years', 'roles', 'loc', 'salary', 'wtp', 'status'] as const).map((c) => (
                <th key={c} scope="col" className="px-3 py-2.5 text-start font-semibold">{a.cols[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-brand-50/50" onClick={() => setOpen(r)}>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</td>
                <td className="px-3 py-2.5">
                  <button className="font-semibold text-brand-800 hover:underline text-start" onClick={(e) => { e.stopPropagation(); setOpen(r) }}>{r.full_name}</button>
                  <div className="text-xs text-muted ltr">{r.email}</div>
                </td>
                <td className="px-3 py-2.5">{r.current_job_title}</td>
                <td className="px-3 py-2.5">{r.years_experience}</td>
                <td className="px-3 py-2.5 max-w-56">{labels(TARGET_ROLES, r.target_roles, lang)}</td>
                <td className="px-3 py-2.5 max-w-48">{labels(LOCATIONS, r.preferred_locations, lang)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{label(SALARY_RANGES, r.min_salary_range, lang)}</td>
                <td className="px-3 py-2.5">{label(WILLING_TO_PAY, r.willing_to_pay, lang)}{r.fair_price_egp != null && <span className="text-muted"> ({r.fair_price_egp})</span>}</td>
                <td className="px-3 py-2.5"><StatusPill s={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <Detail applicant={open} onClose={() => setOpen(null)} onChange={(u) => { updateLocal(u); setOpen(u) }} />}
    </>
  )
}

function StatusPill({ s }: { s: Status }) {
  const { a } = useAdminT()
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 whitespace-nowrap ${STATUS_STYLE[s]}`}>{a.statuses[s]}</span>
}

function Detail({ applicant: r, onClose, onChange }: { applicant: Applicant; onClose: () => void; onChange: (a: Applicant) => void }) {
  const { a, lang } = useAdminT()
  const [consents, setConsents] = useState<ConsentRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const loadNotes = useCallback(async () => {
    const { data } = await supabase!.from('admin_notes').select('id, note, author_email, created_at').eq('applicant_id', r.id).order('created_at', { ascending: false })
    setNotes((data as NoteRow[]) ?? [])
  }, [r.id])

  useEffect(() => {
    supabase!.from('consents').select('*').eq('applicant_id', r.id).order('id').then(({ data }) => setConsents((data as ConsentRow[]) ?? []))
    void loadNotes()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [r.id, loadNotes])

  async function setStatus(s: Status) {
    setBusy('status'); setMsg(null)
    const { data, error } = await supabase!.from('applicants').update({ status: s }).eq('id', r.id).select('*').single()
    setBusy(null)
    if (error) { setMsg(error.message); return }
    onChange(data as Applicant); setMsg(a.saved)
  }

  async function downloadCv() {
    setBusy('cv'); setMsg(null)
    const { data, error } = await supabase!.storage.from(CV_BUCKET).createSignedUrl(r.cv_path, 60, {
      download: `CV - ${r.full_name}.${r.cv_path.split('.').pop()}`,
    })
    setBusy(null)
    if (error || !data) { setMsg(error?.message ?? 'Error'); return }
    window.location.href = data.signedUrl
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setBusy('note')
    const { error } = await supabase!.from('admin_notes').insert({ applicant_id: r.id, note: note.trim() })
    setBusy(null)
    if (error) { setMsg(error.message); return }
    setNote(''); void loadNotes()
  }

  const F = a.fields
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted">{k}</dt><dd className="break-words">{v || '—'}</dd>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="det-title"
        className="h-full w-full max-w-xl overflow-y-auto bg-paper shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <div>
            <h2 id="det-title" className="font-bold text-lg">{r.full_name}</h2>
            <p className="text-xs text-muted">{fmtDate(r.created_at, lang)}</p>
          </div>
          <button className="rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-line hover:bg-brand-50" onClick={onClose} autoFocus>{a.close}</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <label htmlFor="det-status" className="text-sm font-semibold">{a.status}</label>
            <select id="det-status" className="input !min-h-10 !w-auto !py-2 text-sm" value={r.status} disabled={busy === 'status'}
              onChange={(e) => void setStatus(e.target.value as Status)}>
              {STATUSES.map((s) => <option key={s} value={s}>{a.statuses[s]}</option>)}
            </select>
            <button className="btn-primary !min-h-10 !py-2 text-sm ms-auto" onClick={() => void downloadCv()} disabled={busy === 'cv'}>
              {busy === 'cv' && <Spinner />}{a.downloadCv}
            </button>
            {msg && <p className="w-full text-sm text-muted" role="status">{msg}</p>}
          </div>

          <section className="card p-4">
            <h3 className="mb-1 font-bold">{a.contact}</h3>
            <dl>
              {row(F.email, <a className="ltr text-brand-700 underline" href={`mailto:${r.email}`}>{r.email}</a>)}
              {row(F.mobile, <a className="ltr text-brand-700 underline" href={`tel:${r.mobile}`}>{r.mobile}</a>)}
              {row(F.linkedin, r.linkedin_url && <a className="ltr text-brand-700 underline break-all" href={r.linkedin_url} target="_blank" rel="noopener noreferrer">{r.linkedin_url}</a>)}
              {row(F.lang, r.language.toUpperCase())}
            </dl>
          </section>

          <section className="card p-4">
            <h3 className="mb-1 font-bold">{a.profile}</h3>
            <dl>
              {row(F.title, r.current_job_title)}
              {row(F.years, r.years_experience)}
              {row(F.industry, r.current_industry)}
            </dl>
          </section>

          <section className="card p-4">
            <h3 className="mb-1 font-bold">{a.prefs}</h3>
            <dl>
              {row(F.roles, labels(TARGET_ROLES, r.target_roles, lang))}
              {row(F.locations, labels(LOCATIONS, r.preferred_locations, lang))}
              {r.preferred_location_other && row(F.other, r.preferred_location_other)}
              {row(F.commute, label(COMMUTE, String(r.max_commute_minutes), lang))}
              {row(F.mode, labels(WORK_MODES, r.work_modes, lang))}
              {row(F.salary, label(SALARY_RANGES, r.min_salary_range, lang))}
            </dl>
          </section>

          <section className="card p-4">
            <h3 className="mb-1 font-bold">{a.research}</h3>
            <dl>
              {row(F.apps, label(APPS_LAST_MONTH, r.applications_last_month, lang))}
              {row(F.wtp, label(WILLING_TO_PAY, r.willing_to_pay, lang))}
              {row(F.fair, r.fair_price_egp)}
              {row(F.price, r.price_shown_egp)}
              {row(F.heard, label(HEARD_FROM, r.heard_from, lang) + (r.heard_from_other ? ` — ${r.heard_from_other}` : ''))}
            </dl>
          </section>

          <section className="card p-4">
            <h3 className="mb-2 font-bold">{a.notes}</h3>
            <form onSubmit={addNote} className="space-y-2">
              <label htmlFor="det-note" className="sr-only">{a.addNote}</label>
              <textarea id="det-note" className="input min-h-20 text-sm" placeholder={a.notePlaceholder} value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-ghost !min-h-10 !py-2 text-sm" disabled={busy === 'note' || !note.trim()}>{a.addNote}</button>
            </form>
            <ul className="mt-3 space-y-2">
              {!notes.length && <li className="text-sm text-muted">{a.noNotes}</li>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-paper p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.note}</p>
                  <p className="mt-1 text-xs text-muted"><span className="ltr">{n.author_email}</span> · {fmtDate(n.created_at, lang)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h3 className="mb-2 font-bold">{a.consents}</h3>
            <ul className="space-y-2">
              {consents.map((c) => (
                <li key={c.consent_key} className="rounded-lg bg-paper p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs">{c.consent_key}</code>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.granted ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>{c.granted ? a.granted : a.declined}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.consent_text}</p>
                  <p className="mt-1 text-xs text-muted ltr">v{c.consent_version} · {c.language} · {fmtDate(c.granted_at, lang)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  )
}

// ───────────────────────────── Deletion requests ─────────────────────────────
function Deletions({ reload, applicants }: { reload: () => Promise<void>; applicants: Applicant[] }) {
  const { a, lang } = useAdminT()
  const [rows, setRows] = useState<DeletionRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase!.from('deletion_requests').select('*').order('created_at', { ascending: false })
    if (error) setMsg({ tone: 'danger', text: error.message })
    setRows((data as DeletionRow[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  async function deleteAll(req: DeletionRow) {
    if (!req.email || !window.confirm(a.del.confirm(req.email))) return
    setBusy(req.id); setMsg(null)
    try {
      // 1) Find every application for this email and remove CV files via the Storage API.
      const { data: apps, error: e1 } = await supabase!.from('applicants').select('id, cv_path').eq('email', req.email.toLowerCase())
      if (e1) throw e1
      const exact = (apps ?? []) as { id: string; cv_path: string }[]
      // List each applicant folder too, in case of multiple uploads under the same id.
      const paths = new Set(exact.map((x) => x.cv_path))
      for (const x of exact) {
        const { data: files } = await supabase!.storage.from(CV_BUCKET).list(x.id)
        files?.forEach((f) => paths.add(`${x.id}/${f.name}`))
      }
      if (paths.size) {
        const { error: e2 } = await supabase!.storage.from(CV_BUCKET).remove([...paths])
        if (e2) throw e2
      }
      // 2) Delete DB rows (applicant → consents, notes cascade) and close + redact the request.
      const { data: n, error: e3 } = await supabase!.rpc('admin_complete_deletion', { p_request_id: req.id })
      if (e3) throw e3
      setMsg({ tone: 'info', text: a.del.done(n as number) })
      await Promise.all([load(), reload()])
    } catch (e) {
      setMsg({ tone: 'danger', text: String((e as Error).message ?? e) })
    } finally {
      setBusy(null)
    }
  }

  async function dismiss(req: DeletionRow) {
    setBusy(req.id)
    await supabase!.from('deletion_requests').update({ status: 'rejected' }).eq('id', req.id)
    setBusy(null); void load()
  }

  async function cleanOrphans() {
    setBusy('orphans'); setMsg(null)
    const { data, error } = await supabase!.rpc('admin_orphan_cvs')
    if (error) { setMsg({ tone: 'danger', text: error.message }); setBusy(null); return }
    const paths = (data as string[]) ?? []
    if (paths.length) {
      const { error: e2 } = await supabase!.storage.from(CV_BUCKET).remove(paths)
      if (e2) { setMsg({ tone: 'danger', text: e2.message }); setBusy(null); return }
    }
    setMsg({ tone: 'info', text: a.del.orphansDone(paths.length) }); setBusy(null)
  }

  const matchCount = (email: string | null) => (email ? applicants.filter((x) => x.email.toLowerCase() === email.toLowerCase()).length : 0)

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {!rows ? <p className="text-muted">{a.loading}</p> : !rows.length ? <p className="text-muted">{a.del.none}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold ltr break-all">{r.email ?? <span className="text-muted">({a.del.redacted})</span>}</p>
                <p className="text-xs text-muted">{a.del.requested}: {fmtDate(r.created_at, lang)}
                  {r.status === 'pending' && <> · {a.del.matches(matchCount(r.email))}</>}
                  {r.status === 'completed' && r.deleted_applicants != null && <> · {a.del.deletedRows(r.deleted_applicants)}</>}
                </p>
                {r.reason && <p className="mt-1 text-sm">{a.del.reason}: {r.reason}</p>}
              </div>
              {r.status === 'pending' ? (
                <div className="flex gap-2">
                  <button className="btn-ghost !min-h-10 !py-2 text-sm" disabled={!!busy} onClick={() => void dismiss(r)}>{a.del.reject}</button>
                  <button className="btn !min-h-10 !py-2 text-sm bg-danger text-white hover:opacity-90" disabled={!!busy} onClick={() => void deleteAll(r)}>
                    {busy === r.id && <Spinner />}{a.del.action}
                  </button>
                </div>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                  {r.status === 'completed' ? a.del.completed : r.status}{r.completed_at && ` · ${fmtDate(r.completed_at, lang)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="card p-4">
        <button className="btn-ghost !min-h-10 !py-2 text-sm" disabled={!!busy} onClick={() => void cleanOrphans()}>
          {busy === 'orphans' && <Spinner />}{a.del.orphans}
        </button>
        <p className="mt-2 text-xs text-muted">{a.del.orphansHint}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────── Stats ───────────────────────────────
function Stats({ rows }: { rows: Applicant[] }) {
  const { a, lang } = useAdminT()
  const [total, setTotal] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [views, setViews] = useState<{ path: string; day: string; count: number }[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase!.from('pilot_settings').select('total_seats').single().then(({ data }) => {
      if (data) { setTotal(data.total_seats); setDraft(String(data.total_seats)) }
    })
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
    supabase!.from('page_views').select('*').gte('day', since).then(({ data }) => setViews(data ?? []))
  }, [])

  async function save() {
    const n = Number(draft)
    if (!Number.isInteger(n) || n < 0) return
    const { error } = await supabase!.from('pilot_settings').update({ total_seats: n }).eq('id', true)
    if (!error) { setTotal(n); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const taken = rows.filter((r) => ['new', 'accepted', 'active', 'done'].includes(r.status)).length
  const byStatus = STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as const)
  const byWtp = WILLING_TO_PAY.map((o) => [o[lang], rows.filter((r) => r.willing_to_pay === o.value).length] as const)
  const d7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
  const paths = [...new Set(views.map((v) => v.path))].sort()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card p-5">
        <h3 className="font-bold">{a.stats.seats}</h3>
        <p className="mt-2 text-3xl font-bold text-brand-800">{taken} <span className="text-base font-normal text-muted">/ {total ?? '…'} {a.stats.taken}</span></p>
        <div className="mt-4 flex items-end gap-2">
          <div>
            <label htmlFor="seats-total" className="field-label text-sm">{a.stats.total}</label>
            <input id="seats-total" inputMode="numeric" className="input !min-h-10 !py-2 w-28" value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button className="btn-primary !min-h-10 !py-2 text-sm" onClick={() => void save()}>{a.stats.save}</button>
          {saved && <span className="text-sm text-muted" role="status">{a.saved}</span>}
        </div>
      </section>
      <section className="card p-5">
        <h3 className="font-bold">{a.stats.byStatus}</h3>
        <ul className="mt-3 space-y-1.5">
          {byStatus.map(([s, n]) => (
            <li key={s} className="flex items-center justify-between text-sm"><StatusPill s={s} /><span className="font-semibold tabular-nums">{n}</span></li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h3 className="font-bold">{a.stats.wtp}</h3>
        <ul className="mt-3 space-y-1.5">
          {byWtp.map(([l, n]) => (
            <li key={l} className="flex justify-between text-sm"><span>{l}</span><span className="font-semibold tabular-nums">{n}</span></li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h3 className="font-bold">{a.stats.views}</h3>
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-muted"><tr><th className="text-start font-semibold py-1">{a.stats.path}</th><th className="text-end font-semibold">{a.stats.views7}</th><th className="text-end font-semibold">{a.stats.views30}</th></tr></thead>
          <tbody>
            {paths.map((p) => (
              <tr key={p} className="border-t border-line">
                <td className="py-1.5 ltr text-start">{p}</td>
                <td className="text-end tabular-nums">{views.filter((v) => v.path === p && v.day >= d7).reduce((s, v) => s + v.count, 0)}</td>
                <td className="text-end tabular-nums">{views.filter((v) => v.path === p).reduce((s, v) => s + v.count, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

// ─────────────────────────────── Orders ───────────────────────────────
type OrderRow = {
  id: string; created_at: string; plan: string; price_shown: string | null; full_name: string; email: string
  mobile: string; language: string; status: 'pending' | 'link_sent' | 'paid' | 'cancelled' | 'refunded'; admin_note: string | null
}
const ORDER_STATUSES = ['pending', 'link_sent', 'paid', 'cancelled', 'refunded'] as const

function Orders({ applicants }: { applicants: Applicant[] }) {
  const { a, lang } = useAdminT()
  const [rows, setRows] = useState<OrderRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data, error } = await supabase!.from('orders').select('*').order('created_at', { ascending: false })
    if (error) setErr(error.message)
    setRows((data as OrderRow[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  async function update(id: string, patch: Partial<OrderRow>) {
    const { error } = await supabase!.from('orders').update(patch).eq('id', id)
    if (error) { setErr(error.message); return }
    void load()
  }

  const emails = new Set(applicants.map((x) => x.email.toLowerCase()))
  if (!rows) return <p className="text-muted">{a.loading}</p>
  return (
    <div className="space-y-2">
      {err && <Alert tone="danger">{err}</Alert>}
      {!rows.length && <p className="text-muted">{a.orders.none}</p>}
      {rows.map((o) => (
        <div key={o.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{o.full_name}</p>
              <p className="text-sm text-muted">
                <a className="ltr underline" href={`mailto:${o.email}`}>{o.email}</a> · <a className="ltr underline" href={`tel:${o.mobile}`}>{o.mobile}</a>
              </p>
              <p className="mt-1 text-xs text-muted">
                {fmtDate(o.created_at, lang)} · {a.orders.plan}: {o.plan} · {a.orders.price}: {o.price_shown ?? '—'} · {o.language.toUpperCase()}
              </p>
              <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${emails.has(o.email.toLowerCase()) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {emails.has(o.email.toLowerCase()) ? a.orders.yes : a.orders.no}
              </p>
            </div>
            <select aria-label={a.status} className="input !min-h-10 !w-auto !py-2 text-sm" value={o.status}
              onChange={(e) => void update(o.id, { status: e.target.value as OrderRow['status'] })}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{a.orders.statuses[s]}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <label htmlFor={`on-${o.id}`} className="sr-only">{a.orders.note}</label>
            <input id={`on-${o.id}`} className="input !min-h-10 !py-2 text-sm" placeholder={a.orders.note} maxLength={2000}
              value={notes[o.id] ?? o.admin_note ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [o.id]: e.target.value }))} />
            <button className="btn-ghost !min-h-10 !py-2 text-sm whitespace-nowrap"
              onClick={() => void update(o.id, { admin_note: (notes[o.id] ?? o.admin_note ?? '').trim() || null })}>{a.orders.saveNote}</button>
          </div>
        </div>
      ))}
    </div>
  )
}
