import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'

export default function ThankYou() {
  const { t } = useI18n()
  const loc = useLocation()
  const status = (loc.state as { status?: string } | null)?.status ?? new URLSearchParams(loc.search).get('status')
  const waitlist = status === 'waitlist'
  return (
    <div className="section max-w-2xl py-12">
      <div className="card p-6 sm:p-8 text-center">
        <span aria-hidden="true" className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${waitlist ? 'bg-warn-50 text-warn-700' : 'bg-brand-50 text-brand-700'}`}>
          {waitlist
            ? <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            : <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5 9-10" /></svg>}
        </span>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{waitlist ? t.thanks.titleWaitlist : t.thanks.title}</h1>
        <p className="mt-2 text-muted">{waitlist ? t.thanks.subWaitlist : t.thanks.sub}</p>
      </div>

      <section className="mt-6 card p-6 sm:p-8">
        <h2 className="text-xl font-bold">{t.thanks.nextTitle}</h2>
        <ol className="mt-4 space-y-3">
          {t.thanks.next.map((x, i) => (
            <li key={x} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-800 text-sm font-bold text-accent">{i + 1}</span>
              <span>{x}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-xl bg-brand-50 p-4 text-[15px] text-brand-800">{t.thanks.tip}</p>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link to="/" className="btn-primary">{t.thanks.home}</Link>
        <Link to="/delete-my-data" className="btn-ghost">{t.thanks.delete}</Link>
      </div>
    </div>
  )
}
