import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { PILOT_PRICE_EGP } from '../config'

export const PRICE_IS_TBD = String(PILOT_PRICE_EGP).includes('TBD')

export default function Pricing() {
  const { t } = useI18n()
  const P = t.pricePage
  return (
    <div className="section max-w-3xl py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">{P.title}</h1>
      <p className="mt-2 text-muted">{P.sub}</p>

      <div className="mt-6 card p-6 sm:p-8 ring-2 ring-brand-800">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-bold text-xl">{t.pricing.plan}</p>
            <p className="text-muted">{t.pricing.duration}</p>
          </div>
          <p className="text-3xl font-bold text-brand-800">{t.pricing.price(String(PILOT_PRICE_EGP))}</p>
        </div>
        {PRICE_IS_TBD && <p className="mt-3 rounded-lg bg-warn-50 p-3 text-sm text-warn-700">{P.tbd}</p>}
        <ul className="mt-5 space-y-2">
          {t.pricing.includes.map((x) => (
            <li key={x} className="flex gap-2"><span aria-hidden="true" className="text-brand-600">✓</span>{x}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/checkout" className="btn-accent flex-1">{P.cta}</Link>
          <Link to="/consent" className="btn-ghost flex-1">{P.apply}</Link>
        </div>
      </div>

      <section className="mt-8 card p-6">
        <h2 className="text-xl font-bold">{P.howTitle}</h2>
        <ol className="mt-4 space-y-3">
          {P.how.map((x, i) => (
            <li key={x} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-800 text-sm font-bold text-accent">{i + 1}</span>
              <span>{x}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex gap-2 rounded-xl bg-brand-50 p-4 text-[15px] text-brand-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          {P.safe}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">{P.faqTitle}</h2>
        <div className="mt-4 space-y-3">
          {P.faq.map((f) => (
            <details key={f.q} className="card group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold min-h-14">
                {f.q}<span aria-hidden="true" className="text-xl text-brand-600 transition group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 -mt-1 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
