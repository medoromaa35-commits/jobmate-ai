import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../i18n/I18n'
import { Alert, Spinner } from '../../components/ui'
import { LOCATIONS, label, type Lang } from '../../content/options'
import { ADMIN_STRINGS } from './adminStrings'
import { callAi, pool } from './ai'
import { buildCvDocx, downloadBlob, type CvProfile } from './cvDocx'
import { buildEmailDraft } from './emailDraft'

function useA() {
  const { lang } = useI18n()
  return { a: ADMIN_STRINGS[lang], lang }
}

type Job = {
  id: string; created_at: string; title: string; company: string | null; location: string | null
  work_mode: string | null; source_url: string | null; description: string; status: 'active' | 'closed'
}
type Analysis = {
  summary?: string; strengths?: string[]; gaps?: string[]; advice?: string
  seniority_fit?: string; location_fit?: string; salary_note?: string
}
type MatchStatus = 'suggested' | 'approved' | 'sent' | 'applied' | 'interview' | 'rejected' | 'hidden'
type Match = {
  id: string; job_id: string; score: number | null; verdict: 'strong' | 'good' | 'partial' | 'weak' | null
  analysis: Analysis | null; status: MatchStatus; tailored_cv: CvProfile | null; cover_letter: string | null
  changes: { changes?: string[]; warnings?: string[] } | null
  jobs: { title: string; company: string | null; location: string | null; source_url: string | null; status: string } | null
}
export type AiApplicant = {
  id: string; full_name: string; email: string; mobile: string; language: Lang
  preferred_locations: string[]; linkedin_url: string | null
}

const MATCH_STATUSES: MatchStatus[] = ['suggested', 'approved', 'sent', 'applied', 'interview', 'rejected', 'hidden']
const VERDICT_STYLE = {
  strong: 'bg-emerald-100 text-emerald-800', good: 'bg-sky-100 text-sky-800',
  partial: 'bg-amber-100 text-amber-800', weak: 'bg-rose-100 text-rose-800',
}

function errText(a: (typeof ADMIN_STRINGS)['en'], e: unknown) {
  const code = String((e as Error)?.message ?? e)
  return a.ai.errors[code] ?? code
}

// ───────────────────────────────── Jobs tab ─────────────────────────────────
export function Jobs() {
  const { a } = useA()
  const J = a.jobs
  const [rows, setRows] = useState<Job[] | null>(null)
  const [f, setF] = useState({ title: '', company: '', location: '', work_mode: '', source_url: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase!.from('jobs').select('*').order('created_at', { ascending: false })
    if (error) setErr(error.message)
    setRows((data as Job[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (f.title.trim().length < 2 || f.description.trim().length < 30) { setErr(J.needTitle); return }
    setBusy(true)
    const { error } = await supabase!.from('jobs').insert({
      title: f.title.trim(), company: f.company.trim() || null, location: f.location.trim() || null,
      work_mode: f.work_mode || null, source_url: f.source_url.trim() || null, description: f.description.trim(),
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setF({ title: '', company: '', location: '', work_mode: '', source_url: '', description: '' })
    void load()
  }

  async function setStatus(id: string, status: 'active' | 'closed') {
    await supabase!.from('jobs').update({ status }).eq('id', id); void load()
  }
  async function remove(id: string) {
    if (!window.confirm(J.confirmDelete)) return
    await supabase!.from('jobs').delete().eq('id', id); void load()
  }

  const inp = 'input !min-h-10 !py-2 text-sm'
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card space-y-3 p-4" noValidate>
        <h3 className="font-bold">{J.add}</h3>
        <p className="rounded-lg bg-warn-50 p-3 text-xs text-warn-700">{J.legal}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inp} placeholder={J.title} aria-label={J.title} value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className={inp} placeholder={J.company} aria-label={J.company} value={f.company} maxLength={200} onChange={(e) => setF({ ...f, company: e.target.value })} />
          <input className={inp} placeholder={J.location} aria-label={J.location} value={f.location} maxLength={200} onChange={(e) => setF({ ...f, location: e.target.value })} />
          <select className={inp} aria-label={J.mode} value={f.work_mode} onChange={(e) => setF({ ...f, work_mode: e.target.value })}>
            <option value="">{J.mode}: {J.anyMode}</option>
            <option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
          </select>
          <input className={`${inp} sm:col-span-2 ltr`} type="url" placeholder={J.url} aria-label={J.url} value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} />
          <textarea className="input min-h-40 text-sm sm:col-span-2" placeholder={J.description} aria-label={J.description} value={f.description} maxLength={30000}
            onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        {err && <Alert tone="danger">{err}</Alert>}
        <button className="btn-primary !min-h-10 !py-2 text-sm" disabled={busy}>{busy && <Spinner />}{busy ? J.saving : J.save}</button>
      </form>

      {rows && <p className="text-sm text-muted">{J.count(rows.filter((r) => r.status === 'active').length)}</p>}
      {rows && !rows.length && <p className="text-muted">{J.none}</p>}
      <ul className="space-y-2">
        {rows?.map((j) => (
          <li key={j.id} className={`card p-4 ${j.status === 'closed' ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button className="min-w-0 flex-1 text-start" onClick={() => setOpen(open === j.id ? null : j.id)}>
                <p className="font-semibold">{j.title}{j.company && <span className="font-normal text-muted"> — {j.company}</span>}</p>
                <p className="text-xs text-muted">{[j.location, j.work_mode].filter(Boolean).join(' · ')}</p>
              </button>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${j.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>
                  {j.status === 'active' ? J.active : J.closed}
                </span>
                {j.source_url && <a className="text-xs text-brand-700 underline" href={j.source_url} target="_blank" rel="noopener noreferrer">↗</a>}
                <button className="text-xs underline" onClick={() => void setStatus(j.id, j.status === 'active' ? 'closed' : 'active')}>{j.status === 'active' ? J.close : J.reopen}</button>
                <button className="text-xs text-danger underline" onClick={() => void remove(j.id)}>{J.remove}</button>
              </div>
            </div>
            {open === j.id && <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm">{j.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────── AI panel (applicant drawer) ───────────────────────────
export function AiPanel({ applicant, hasAiConsent }: { applicant: AiApplicant; hasAiConsent: boolean }) {
  const { a, lang } = useA()
  const A = a.ai
  const [cv, setCv] = useState<CvProfile | null | undefined>(undefined)
  const [matches, setMatches] = useState<Match[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase!.from('cv_profiles').select('parsed').eq('applicant_id', applicant.id).maybeSingle(),
      supabase!.from('matches').select('*, jobs(title, company, location, source_url, status)').eq('applicant_id', applicant.id).order('score', { ascending: false }),
    ])
    setCv((p?.parsed as CvProfile) ?? null)
    setMatches((m as Match[]) ?? [])
  }, [applicant.id])
  useEffect(() => { void load() }, [load])

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); setErr(null)
    try { await fn() } catch (e) { setErr(errText(a, e)) } finally { setBusy(null); setProgress(null) }
  }

  const parse = () => run('parse', async () => {
    const r = await callAi<{ parsed: CvProfile }>({ action: 'parse_cv', applicant_id: applicant.id })
    setCv(r.parsed)
  })

  const matchAll = (rescore: boolean) => run('match', async () => {
    const { data: jobs } = await supabase!.from('jobs').select('id').eq('status', 'active')
    const done = new Set(matches.map((m) => m.job_id))
    const todo = (jobs ?? []).map((j) => j.id as string).filter((id) => rescore || !done.has(id))
    if (!(jobs ?? []).length) { setErr(A.noJobs); return }
    setProgress([0, todo.length])
    const errors: string[] = []
    await pool(todo, 3, async (jobId) => {
      try { await callAi({ action: 'match', applicant_id: applicant.id, job_id: jobId }) } catch (e) { errors.push(errText(a, e)) }
    }, (n) => setProgress([n, todo.length]))
    await load()
    if (errors.length) setErr([...new Set(errors)].join(' · '))
  })

  const tailor = (m: Match) => run(`tailor-${m.id}`, async () => {
    await callAi({ action: 'tailor', match_id: m.id })
    await load()
  })

  async function setStatus(m: Match, status: MatchStatus) {
    await supabase!.from('matches').update({ status }).eq('id', m.id)
    setMatches((xs) => xs.map((x) => (x.id === m.id ? { ...x, status } : x)))
  }

  const contact = () => ({
    name: applicant.full_name, email: applicant.email, mobile: applicant.mobile, linkedin: applicant.linkedin_url,
    location: applicant.preferred_locations.length ? label(LOCATIONS, applicant.preferred_locations[0], 'en') + ', Egypt' : 'Egypt',
  })
  const safeName = applicant.full_name.replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'CV'

  async function downloadCv(c: CvProfile, suffix: string) {
    downloadBlob(await buildCvDocx(c, contact()), `${safeName} - CV${suffix ? ` - ${suffix}` : ''}.docx`)
  }

  function copy(text: string, key: string) {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500) })
  }

  function makeEmail() {
    const approved = matches.filter((m) => m.status === 'approved')
    const pick = (approved.length ? approved : matches.filter((m) => m.status !== 'hidden' && m.status !== 'rejected').slice(0, 5))
    setEmail(buildEmailDraft(applicant.full_name, applicant.language, pick.map((m) => ({
      title: m.jobs?.title ?? '', company: m.jobs?.company ?? null, location: m.jobs?.location ?? null, url: m.jobs?.source_url ?? null,
      score: m.score, summary: m.analysis?.summary ?? '', strengths: m.analysis?.strengths ?? [], gaps: m.analysis?.gaps ?? [],
      hasCv: !!m.tailored_cv,
    }))))
  }

  const small = '!min-h-10 !py-2 text-sm'
  return (
    <section className="card p-4">
      <h3 className="mb-2 font-bold">✨ {A.title}</h3>
      {!hasAiConsent ? <Alert tone="warn">{A.noConsent}</Alert> : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className={`btn-ghost ${small}`} disabled={!!busy} onClick={() => void parse()}>
              {busy === 'parse' && <Spinner />}{busy === 'parse' ? A.parsing : cv ? A.reparse : A.parse}
            </button>
            <button className={`btn-primary ${small}`} disabled={!!busy || !cv} onClick={() => void matchAll(false)}>
              {busy === 'match' && <Spinner />}{busy === 'match' && progress ? A.matching(progress[0], progress[1]) : A.match}
            </button>
            {matches.length > 0 && <button className="text-xs underline" disabled={!!busy} onClick={() => void matchAll(true)}>{A.rematch}</button>}
            {cv && <button className="text-xs underline" onClick={() => void downloadCv(cv, '')}>{A.original}</button>}
          </div>
          <p className="text-xs text-muted">{cv === undefined ? '…' : cv ? `✅ ${A.parsed}: ${cv.headline || ''}` : A.notParsed}</p>
          {err && <Alert tone="danger">{err}</Alert>}

          {matches.length === 0 && cv && <p className="text-sm text-muted">{A.none}</p>}
          <ul className="space-y-3">
            {matches.map((m) => (
              <li key={m.id} className={`rounded-xl bg-paper p-3 ring-1 ring-line ${m.status === 'hidden' ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{m.jobs?.title}{m.jobs?.company && <span className="font-normal text-muted"> — {m.jobs.company}</span>}</p>
                    <p className="text-xs text-muted">{m.jobs?.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-bold text-brand-800 tabular-nums">{m.score ?? '—'}%</span>
                    {m.verdict && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_STYLE[m.verdict]}`}>{A.verdicts[m.verdict]}</span>}
                  </div>
                </div>
                {m.analysis?.summary && <p className="mt-2 text-sm">{m.analysis.summary}</p>}
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  {!!m.analysis?.strengths?.length && <div><p className="font-semibold text-emerald-800">{A.strengths}</p><ul className="list-disc ps-4">{m.analysis.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                  {!!m.analysis?.gaps?.length && <div><p className="font-semibold text-rose-800">{A.gaps}</p><ul className="list-disc ps-4">{m.analysis.gaps.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                </div>
                {m.analysis?.advice && <p className="mt-2 text-xs"><b>{A.advice}:</b> {m.analysis.advice}</p>}
                <p className="mt-1 text-[11px] text-muted">
                  {A.seniority}: {m.analysis?.seniority_fit ?? '—'} · {A.locationFit}: {m.analysis?.location_fit ?? '—'} · {A.salary}: {m.analysis?.salary_note || '—'}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select aria-label={a.status} className={`input !w-auto ${small}`} value={m.status} onChange={(e) => void setStatus(m, e.target.value as MatchStatus)}>
                    {MATCH_STATUSES.map((s) => <option key={s} value={s}>{A.statuses[s]}</option>)}
                  </select>
                  <button className={`btn-ghost ${small}`} disabled={!!busy} onClick={() => void tailor(m)}>
                    {busy === `tailor-${m.id}` && <Spinner />}{busy === `tailor-${m.id}` ? A.tailoring : m.tailored_cv ? A.retailor : A.tailor}
                  </button>
                  {m.tailored_cv && <button className={`btn-primary ${small}`} onClick={() => void downloadCv(m.tailored_cv!, m.jobs?.title ?? '')}>{A.download}</button>}
                  {m.jobs?.source_url && <a className="text-xs text-brand-700 underline" href={m.jobs.source_url} target="_blank" rel="noopener noreferrer">↗</a>}
                </div>

                {m.tailored_cv && (
                  <div className="mt-3 space-y-2 rounded-lg bg-white p-3 text-xs ring-1 ring-line">
                    <p className="font-semibold text-warn-700">⚠️ {A.review}</p>
                    {!!m.changes?.warnings?.length && <div><p className="font-semibold">{A.warnings}</p><ul className="list-disc ps-4">{m.changes.warnings.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                    {!!m.changes?.changes?.length && <details><summary className="cursor-pointer font-semibold">{A.changes}</summary><ul className="list-disc ps-4">{m.changes.changes.map((x) => <li key={x}>{x}</li>)}</ul></details>}
                    {m.cover_letter && (
                      <details>
                        <summary className="cursor-pointer font-semibold">{A.cover}</summary>
                        <p className="mt-1 whitespace-pre-wrap ltr text-start">{m.cover_letter}</p>
                        <button className="mt-1 underline" onClick={() => copy(m.cover_letter!.replace('[Name]', applicant.full_name), `cl-${m.id}`)}>{copied === `cl-${m.id}` ? A.copied : A.copy}</button>
                      </details>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {matches.length > 0 && (
            <div className="space-y-2 border-t border-line pt-3">
              <button className={`btn-ghost ${small}`} onClick={makeEmail}>✉️ {A.email}</button>
              <p className="text-xs text-muted">{A.emailHint}</p>
              {email && (
                <div className="space-y-2 rounded-lg bg-paper p-3 text-sm">
                  <p><b>{A.subject}:</b> {email.subject} <button className="text-xs underline" onClick={() => copy(email.subject, 'subj')}>{copied === 'subj' ? A.copied : A.copy}</button></p>
                  <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-sm" dir={lang === 'ar' && applicant.language === 'ar' ? 'rtl' : 'auto'}>{email.body}</pre>
                  <div className="flex gap-3 text-xs">
                    <button className="underline" onClick={() => copy(email.body, 'body')}>{copied === 'body' ? A.copied : A.copy}</button>
                    <a className="underline" href={`mailto:${applicant.email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}>{A.openMail}</a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
