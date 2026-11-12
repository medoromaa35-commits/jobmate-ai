import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { Alert, ChipGroup, Field, Select, Spinner } from '../components/ui'
import {
  APPS_LAST_MONTH, COMMUTE, HEARD_FROM, LOCATIONS, SALARY_RANGES, TARGET_ROLES, WILLING_TO_PAY, WORK_MODES,
} from '../content/options'
import { buildConsentRecords } from '../content/consents'
import { clearConsent, hasRequired, loadConsent } from '../lib/consentStore'
import { checkCv, isEmail, isLinkedIn, normalizeEgyptMobile, toAsciiDigits } from '../lib/validation'
import { CV_BUCKET, supabase } from '../lib/supabase'
import { useSeats } from '../lib/seats'
import { PILOT_PRICE_EGP } from '../config'

type FormState = {
  full_name: string; email: string; mobile: string; website: string
  current_job_title: string; years_experience: string; current_industry: string
  target_roles: string[]; preferred_locations: string[]; preferred_location_other: string
  max_commute_minutes: string; work_modes: string[]; min_salary_range: string
  linkedin_url: string
  applications_last_month: string; willing_to_pay: string; fair_price_egp: string
  heard_from: string; heard_from_other: string
}
type Errors = Partial<Record<keyof FormState | 'cv', string>>

const EMPTY: FormState = {
  full_name: '', email: '', mobile: '', website: '',
  current_job_title: '', years_experience: '', current_industry: '',
  target_roles: [], preferred_locations: [], preferred_location_other: '',
  max_commute_minutes: '', work_modes: [], min_salary_range: '',
  linkedin_url: '',
  applications_last_month: '', willing_to_pay: '', fair_price_egp: '',
  heard_from: '', heard_from_other: '',
}

// Draft (without the CV file) survives a refresh within the same tab only.
const DRAFT_KEY = 'jm_draft'
const loadDraft = (): FormState => {
  try { return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'), website: '' } } catch { return EMPTY }
}

const TOTAL_STEPS = 5

export default function Apply() {
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const seats = useSeats()
  const waitlist = seats.loaded && seats.remaining === 0
  const consent = loadConsent()

  const [step, setStep] = useState(0)
  const [f, setF] = useState<FormState>(loadDraft)
  const [cv, setCv] = useState<{ file: File; ext: 'pdf' | 'docx'; mime: string } | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState<null | 'upload' | 'submit'>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)) } catch { /* ignore */ }
  }, [f])
  useEffect(() => { headingRef.current?.focus(); window.scrollTo(0, 0) }, [step])

  if (!hasRequired(consent)) {
    return (
      <div className="section max-w-xl py-16">
        <Alert tone="warn">{t.form.noConsent}</Alert>
        <Link to="/consent" className="btn-primary mt-6">{t.form.goConsent}</Link>
      </div>
    )
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const err = (k: keyof Errors) => errors[k]
  const inv = (k: keyof Errors) => (errors[k] ? true : undefined)
  const desc = (k: string, hint?: boolean) => (errors[k as keyof Errors] ? `${k}-err` : hint ? `${k}-hint` : undefined)

  function validate(s: number): Errors {
    const e: Errors = {}
    const E = t.errors
    if (s === 0) {
      if (f.full_name.trim().length < 2) e.full_name = E.name
      if (!isEmail(f.email)) e.email = E.email
      if (!normalizeEgyptMobile(f.mobile)) e.mobile = E.mobile
    }
    if (s === 1) {
      if (f.current_job_title.trim().length < 2) e.current_job_title = E.required
      const y = Number(toAsciiDigits(f.years_experience))
      if (f.years_experience.trim() === '' || !Number.isInteger(y) || y < 0 || y > 50) e.years_experience = E.years
      if (f.current_industry.trim().length < 2) e.current_industry = E.required
    }
    if (s === 2) {
      if (!f.target_roles.length) e.target_roles = E.pickOne
      if (!f.preferred_locations.length) e.preferred_locations = E.pickOne
      if (f.preferred_locations.includes('other') && !f.preferred_location_other.trim()) e.preferred_location_other = E.required
      if (!f.max_commute_minutes) e.max_commute_minutes = E.required
      if (!f.work_modes.length) e.work_modes = E.pickOne
      if (!f.min_salary_range) e.min_salary_range = E.required
    }
    if (s === 3) {
      if (!cv) e.cv = E.cvRequired
      if (f.linkedin_url.trim() && !isLinkedIn(f.linkedin_url)) e.linkedin_url = E.linkedin
    }
    if (s === 4) {
      if (!f.applications_last_month) e.applications_last_month = E.required
      if (!f.willing_to_pay) e.willing_to_pay = E.required
      const p = toAsciiDigits(f.fair_price_egp).trim()
      if (p && !(/^\d{1,6}$/.test(p) && Number(p) <= 100000)) e.fair_price_egp = E.price
      if (!f.heard_from) e.heard_from = E.required
    }
    return e
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const r = await checkCv(file)
    if (!r.ok) {
      setCv(null)
      setErrors((e) => ({ ...e, cv: r.reason === 'size' ? t.errors.cvSize : t.errors.cvType }))
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setCv({ file, ext: r.ext, mime: r.mime })
    setErrors((e) => ({ ...e, cv: undefined }))
  }

  function next(e: React.FormEvent) {
    e.preventDefault()
    const v = validate(step)
    setErrors(v)
    if (Object.keys(v).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], fieldset [role="alert"]')?.focus?.())
      return
    }
    if (step < TOTAL_STEPS - 1) setStep(step + 1)
    else void submit()
  }

  async function submit() {
    setSubmitError(null)
    if (!supabase) { setSubmitError(t.errors.notConfigured); return }
    if (!cv) { setStep(3); return }
    const id = crypto.randomUUID()
    const cvPath = `${id}/cv.${cv.ext}`
    try {
      setBusy('upload')
      const up = await supabase.storage.from(CV_BUCKET).upload(cvPath, cv.file, { contentType: cv.mime, upsert: false })
      if (up.error) throw up.error

      setBusy('submit')
      const payload = {
        id, cv_path: cvPath, language: lang, website: f.website,
        full_name: f.full_name.trim(),
        email: f.email.trim().toLowerCase(),
        mobile: normalizeEgyptMobile(f.mobile),
        current_job_title: f.current_job_title.trim(),
        years_experience: Number(toAsciiDigits(f.years_experience)),
        current_industry: f.current_industry.trim(),
        target_roles: f.target_roles,
        preferred_locations: f.preferred_locations,
        preferred_location_other: f.preferred_locations.includes('other') ? f.preferred_location_other.trim() : '',
        max_commute_minutes: Number(f.max_commute_minutes),
        work_modes: f.work_modes,
        min_salary_range: f.min_salary_range,
        linkedin_url: f.linkedin_url.trim(),
        applications_last_month: f.applications_last_month,
        willing_to_pay: f.willing_to_pay,
        fair_price_egp: toAsciiDigits(f.fair_price_egp).trim(),
        heard_from: f.heard_from,
        heard_from_other: f.heard_from === 'other' ? f.heard_from_other.trim() : '',
        price_shown_egp: String(PILOT_PRICE_EGP),
      }
      const { data, error } = await supabase.rpc('submit_application', {
        payload,
        consents: buildConsentRecords(consent!, lang),
      })
      if (error) throw error
      clearConsent()
      try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      nav('/thank-you', { replace: true, state: { status: (data as { status: string }).status } })
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? '')
      if (msg.includes('duplicate_email')) { setSubmitError(t.errors.duplicate) }
      else setSubmitError(t.errors.generic)
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  const progress = Math.round(((step + 1) / TOTAL_STEPS) * 100)
  const price = String(PILOT_PRICE_EGP)

  return (
    <div className="section max-w-2xl py-8 sm:py-10">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-brand-600">{t.form.step(step + 1, TOTAL_STEPS)}</span>
          <span className="text-muted">{progress}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-line overflow-hidden" role="progressbar"
          aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step + 1} aria-label={t.form.step(step + 1, TOTAL_STEPS)}>
          <div className="h-full bg-brand-700 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-3 hidden sm:flex justify-between text-xs text-muted">
          {t.form.stepNames.map((n, i) => (
            <li key={n} className={i === step ? 'font-bold text-ink' : i < step ? 'text-brand-700' : ''}>{n}</li>
          ))}
        </ol>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl sm:text-3xl font-bold outline-none">
        {t.form.stepNames[step]}
      </h1>

      {waitlist && <div className="mt-4"><Alert tone="warn">{t.form.waitlistBanner}</Alert></div>}

      <form onSubmit={next} noValidate className="mt-6 card p-5 sm:p-7 space-y-6">
        {step === 0 && (
          <>
            <Field id="full_name" label={t.form.fullName} error={err('full_name')}>
              <input id="full_name" className="input" autoComplete="name" value={f.full_name}
                aria-invalid={inv('full_name')} aria-describedby={desc('full_name')}
                onChange={(e) => set('full_name', e.target.value)} maxLength={120} />
            </Field>
            <Field id="email" label={t.form.email} error={err('email')}>
              <input id="email" type="email" inputMode="email" autoComplete="email" className="input" value={f.email}
                aria-invalid={inv('email')} aria-describedby={desc('email')}
                onChange={(e) => set('email', e.target.value)} maxLength={254} />
            </Field>
            <Field id="mobile" label={t.form.mobile} hint={t.form.mobileHint} error={err('mobile')}>
              <input id="mobile" type="tel" inputMode="tel" autoComplete="tel" className="input" value={f.mobile}
                placeholder="01012345678" aria-invalid={inv('mobile')} aria-describedby={desc('mobile', true)}
                onChange={(e) => set('mobile', e.target.value)} maxLength={20} />
            </Field>
            {/* Honeypot — hidden from people, bots fill it */}
            <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">{t.form.website}</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field id="current_job_title" label={t.form.jobTitle} hint={t.form.jobTitleHint} error={err('current_job_title')}>
              <input id="current_job_title" className="input" autoComplete="organization-title" value={f.current_job_title}
                aria-invalid={inv('current_job_title')} aria-describedby={desc('current_job_title', true)}
                onChange={(e) => set('current_job_title', e.target.value)} maxLength={120} />
            </Field>
            <Field id="years_experience" label={t.form.years} error={err('years_experience')}>
              <input id="years_experience" inputMode="numeric" className="input max-w-40" value={f.years_experience}
                aria-invalid={inv('years_experience')} aria-describedby={desc('years_experience')}
                onChange={(e) => set('years_experience', e.target.value.replace(/[^\d٠-٩۰-۹]/g, ''))} maxLength={2} />
            </Field>
            <Field id="current_industry" label={t.form.industry} hint={t.form.industryHint} error={err('current_industry')}>
              <input id="current_industry" className="input" value={f.current_industry}
                aria-invalid={inv('current_industry')} aria-describedby={desc('current_industry', true)}
                onChange={(e) => set('current_industry', e.target.value)} maxLength={120} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <ChipGroup name="target_roles" legend={t.form.roles} hint={t.form.multiHint} multiple
              options={TARGET_ROLES} value={f.target_roles} onChange={(v) => set('target_roles', v)} error={err('target_roles')} />
            <ChipGroup name="preferred_locations" legend={t.form.locations} hint={t.form.multiHint} multiple
              options={LOCATIONS} value={f.preferred_locations} onChange={(v) => set('preferred_locations', v)} error={err('preferred_locations')} />
            {f.preferred_locations.includes('other') && (
              <Field id="preferred_location_other" label={t.form.locationOther} error={err('preferred_location_other')}>
                <input id="preferred_location_other" className="input" value={f.preferred_location_other}
                  aria-invalid={inv('preferred_location_other')} maxLength={120}
                  onChange={(e) => set('preferred_location_other', e.target.value)} />
              </Field>
            )}
            <Field id="max_commute_minutes" label={t.form.commute} error={err('max_commute_minutes')}>
              <Select id="max_commute_minutes" options={COMMUTE} value={f.max_commute_minutes}
                invalid={!!err('max_commute_minutes')} onChange={(v) => set('max_commute_minutes', v)} />
            </Field>
            <ChipGroup name="work_modes" legend={t.form.workMode} hint={t.form.multiHint} multiple
              options={WORK_MODES} value={f.work_modes} onChange={(v) => set('work_modes', v)} error={err('work_modes')} />
            <Field id="min_salary_range" label={t.form.salary} error={err('min_salary_range')}>
              <Select id="min_salary_range" options={SALARY_RANGES} value={f.min_salary_range}
                invalid={!!err('min_salary_range')} onChange={(v) => set('min_salary_range', v)} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Alert tone="warn" title={t.form.cvWarnTitle}>{t.form.cvWarn}</Alert>
            <div>
              <span className="field-label" id="cv-label">{t.form.cv}</span>
              <label htmlFor="cv"
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition hover:border-brand-600 hover:bg-brand-50/50 ${err('cv') ? 'border-danger' : cv ? 'border-brand-600 bg-brand-50/50' : 'border-line'}`}>
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" />
                </svg>
                {cv ? (
                  <>
                    <span className="font-semibold ltr break-all">{cv.file.name}</span>
                    <span className="text-sm text-muted ltr">{(cv.file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="text-sm font-semibold text-brand-700 underline">{t.form.cvChange}</span>
                  </>
                ) : (
                  <>
                    <span className="btn-ghost pointer-events-none">{t.form.cvChoose}</span>
                    <span className="text-sm text-muted">{t.form.cvHint}</span>
                  </>
                )}
                <input ref={fileRef} id="cv" type="file" className="sr-only"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  aria-labelledby="cv-label" aria-invalid={inv('cv')} aria-describedby={err('cv') ? 'cv-err' : undefined}
                  onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
              {err('cv') && <p id="cv-err" role="alert" className="field-error">{err('cv')}</p>}
            </div>
            <Field id="linkedin_url" label={t.form.linkedin} optional error={err('linkedin_url')}>
              <input id="linkedin_url" type="url" inputMode="url" className="input" value={f.linkedin_url}
                placeholder="https://www.linkedin.com/in/…" aria-invalid={inv('linkedin_url')} aria-describedby={desc('linkedin_url')}
                onChange={(e) => set('linkedin_url', e.target.value)} maxLength={300} />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <ChipGroup name="applications_last_month" legend={t.form.appsLastMonth}
              options={APPS_LAST_MONTH} value={f.applications_last_month ? [f.applications_last_month] : []}
              onChange={(v) => set('applications_last_month', v[0])} error={err('applications_last_month')} />
            <ChipGroup name="willing_to_pay" legend={t.form.wtp(price)}
              options={WILLING_TO_PAY} value={f.willing_to_pay ? [f.willing_to_pay] : []}
              onChange={(v) => set('willing_to_pay', v[0])} error={err('willing_to_pay')} />
            <Field id="fair_price_egp" label={t.form.fairPrice} optional error={err('fair_price_egp')}>
              <input id="fair_price_egp" inputMode="numeric" className="input max-w-48" value={f.fair_price_egp}
                aria-invalid={inv('fair_price_egp')} aria-describedby={desc('fair_price_egp')}
                onChange={(e) => set('fair_price_egp', e.target.value)} maxLength={6} />
            </Field>
            <Field id="heard_from" label={t.form.heard} error={err('heard_from')}>
              <Select id="heard_from" options={HEARD_FROM} value={f.heard_from}
                invalid={!!err('heard_from')} onChange={(v) => set('heard_from', v)} />
            </Field>
            {f.heard_from === 'other' && (
              <Field id="heard_from_other" label={t.form.heardOther} optional>
                <input id="heard_from_other" className="input" value={f.heard_from_other} maxLength={120}
                  onChange={(e) => set('heard_from_other', e.target.value)} />
              </Field>
            )}
          </>
        )}

        {Object.values(errors).some(Boolean) && <p className="text-sm font-medium text-danger">{t.errors.fixAbove}</p>}
        {submitError && <Alert tone="danger">{submitError}</Alert>}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          {step > 0
            ? <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => { setErrors({}); setStep(step - 1) }}>{t.form.back}</button>
            : <Link to="/consent" className="btn-ghost">{t.form.back}</Link>}
          <button type="submit" className="btn-primary sm:min-w-56" disabled={!!busy}>
            {busy && <Spinner />}
            {busy === 'upload' ? t.form.uploading
              : busy === 'submit' ? t.form.submitting
              : step < TOTAL_STEPS - 1 ? t.form.next
              : waitlist ? t.form.submitWaitlist : t.form.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
