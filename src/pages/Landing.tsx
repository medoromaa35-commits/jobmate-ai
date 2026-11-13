import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { useSeats } from '../lib/seats'
import { PILOT_PRICE_EGP } from '../config'

function SeatsMeter() {
  const { t } = useI18n()
  const s = useSeats()
  const pct = Math.min(100, Math.round((s.taken / Math.max(s.total, 1)) * 100))
  const full = s.loaded && s.remaining === 0
  return (
    <div className="mt-6 max-w-sm" aria-live="polite">
      <div className="flex items-center justify-between text-sm font-semibold text-brand-100">
        <span>
          {!s.loaded ? t.hero.seatsLoading : full ? t.hero.seatsFull : t.hero.seats(s.remaining, s.total)}
        </span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-white/15 overflow-hidden" role="progressbar"
        aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.taken} aria-label={t.hero.seats(s.remaining, s.total)}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: s.loaded ? `${pct}%` : '0%' }} />
      </div>
    </div>
  )
}

function ApplyCta({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const s = useSeats()
  const full = s.loaded && s.remaining === 0
  return (
    <Link to="/consent" className={`btn-accent text-lg px-7 ${className}`}>
      {full ? t.hero.ctaWaitlist : t.hero.cta}
      <span aria-hidden="true" className="rtl:rotate-180">→</span>
    </Link>
  )
}

const StepIcon = ({ n }: { n: number }) => (
  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-800 text-accent text-lg font-bold">{n}</span>
)

export default function Landing() {
  const { t } = useI18n()
  const price = String(PILOT_PRICE_EGP)

  return (
    <>
      {/* HERO */}
      <section className="bg-brand-800 text-white relative overflow-hidden">
        <div aria-hidden="true" className="absolute -top-24 -end-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="section relative py-14 sm:py-20">
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-accent">{t.hero.eyebrow}</p>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold leading-tight max-w-3xl">
            {t.hero.title}
            <span className="block text-accent mt-1">— {t.hero.titleAccent}</span>
          </h1>
          <p className="mt-5 text-lg text-brand-100 max-w-2xl">{t.hero.sub}</p>
          <div className="mt-8"><ApplyCta className="w-full sm:w-auto" /></div>
          <SeatsMeter />
          <p className="mt-3 text-sm text-brand-100/80">{t.hero.note}</p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="section py-14 scroll-mt-16">
        <h2 className="text-2xl sm:text-3xl font-bold">{t.how.title}</h2>
        <p className="mt-2 text-muted">{t.how.sub}</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {t.how.steps.map((s, i) => (
            <li key={i} className="card p-5">
              <StepIcon n={i + 1} />
              <h3 className="mt-4 font-bold text-lg">{s.t}</h3>
              <p className="mt-1 text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* WHO + BYOJ */}
      <section id="who" className="section pb-14 scroll-mt-16 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-2xl font-bold">{t.who.title}</h2>
          <ul className="mt-4 space-y-3">
            {t.who.items.map((x) => (
              <li key={x} className="flex gap-3">
                <span aria-hidden="true" className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                </span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted ltr" dir="ltr">{t.who.roles}</p>
        </div>
        <div className="card p-6 bg-brand-50 ring-brand-100">
          <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-800 ring-1 ring-brand-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
            </svg>
          </span>
          <h2 className="mt-4 text-2xl font-bold">{t.byoj.title}</h2>
          <p className="mt-2 text-ink/80">{t.byoj.body}</p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section pb-14 scroll-mt-16">
        <h2 className="text-2xl sm:text-3xl font-bold">{t.pricing.title}</h2>
        <div className="mt-6 card p-6 sm:p-8 max-w-xl ring-2 ring-brand-800">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-bold text-xl">{t.pricing.plan}</p>
              <p className="text-muted">{t.pricing.duration}</p>
            </div>
            <p className="text-3xl font-bold text-brand-800">{t.pricing.price(price)}</p>
          </div>
          <ul className="mt-5 space-y-2">
            {t.pricing.includes.map((x) => (
              <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-brand-600">✓</span>{x}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted">{t.pricing.note}</p>
          <ApplyCta className="mt-6 w-full" />
          <Link to="/pricing" className="mt-3 block text-center text-sm font-semibold text-brand-700 underline underline-offset-4">{t.pricing.details}</Link>
        </div>
      </section>

      {/* PRIVACY PROMISE */}
      <section className="section pb-14">
        <div className="rounded-2xl bg-white ring-1 ring-line p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-brand-800 text-accent">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>
            </span>
            <h2 className="text-2xl font-bold">{t.privacy.title}</h2>
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-3">
            {t.privacy.items.map((x) => (
              <div key={x.t}>
                <dt className="font-bold">{x.t}</dt>
                <dd className="mt-1 text-muted">{x.d}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/privacy" className="btn-ghost">{t.privacy.policy}</Link>
            <Link to="/delete-my-data" className="btn-ghost">{t.privacy.link}</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section scroll-mt-16">
        <h2 className="text-2xl sm:text-3xl font-bold">{t.faq.title}</h2>
        <div className="mt-6 space-y-3">
          {t.faq.items.map((f) => (
            <details key={f.q} className="card group p-0 open:ring-brand-600">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold min-h-14">
                {f.q}
                <span aria-hidden="true" className="text-xl text-brand-600 transition group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 -mt-1 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center"><ApplyCta /></div>
      </section>
    </>
  )
}
