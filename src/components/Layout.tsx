import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useI18n } from '../i18n/I18n'
import { trackPageView } from '../lib/track'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold text-lg ${light ? 'text-white' : 'text-brand-800'}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={light ? '#ffffff' : '#0f3d3e'} />
        <path d="M20 36c0 6 4 10 10 10s10-4 10-10V18h-8v18c0 2-1 3-2 3s-2-1-2-3v-2h-8z" fill="#f4b860" />
        <circle cx="46" cy="20" r="4" fill="#f4b860" />
      </svg>
      <span className="ltr">JobMate <span className="text-accent-600">AI</span></span>
    </span>
  )
}

export function LangToggle() {
  const { t, toggle, lang } = useI18n()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.langToggleLabel}
      lang={lang === 'ar' ? 'en' : 'ar'}
      className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 ring-1 ring-line bg-white hover:bg-brand-50 min-h-10"
    >
      {t.langToggle}
    </button>
  )
}

export function Header({ minimal = false }: { minimal?: boolean }) {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="section flex h-16 items-center justify-between gap-3">
        <Link to="/" aria-label="JobMate AI"><Logo /></Link>
        <div className="flex items-center gap-2">
          {!minimal && (
            <nav className="hidden md:flex items-center gap-1 text-[15px] text-muted me-2">
              <Link to={{ pathname: '/', hash: '#how' }} className="px-3 py-2 hover:text-ink">{t.nav.how}</Link>
              <Link to={{ pathname: '/', hash: '#who' }} className="px-3 py-2 hover:text-ink">{t.nav.who}</Link>
              <Link to={{ pathname: '/', hash: '#pricing' }} className="px-3 py-2 hover:text-ink">{t.nav.pricing}</Link>
              <Link to={{ pathname: '/', hash: '#faq' }} className="px-3 py-2 hover:text-ink">{t.nav.faq}</Link>
            </nav>
          )}
          <LangToggle />
          {!minimal && (
            <Link to="/consent" className="btn-primary !min-h-10 !py-2 !px-4 text-sm hidden sm:inline-flex">{t.nav.apply}</Link>
          )}
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="mt-20 bg-brand-900 text-brand-100">
      <div className="section py-10 grid gap-6 sm:grid-cols-2">
        <div>
          <Logo light />
          <p className="mt-3 text-sm text-brand-100/80">{t.footer.tagline}</p>
          <p className="mt-1 text-sm text-brand-100/80 ltr inline-block">{t.footer.contact}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:justify-end sm:items-start">
          <NavLink to="/privacy" className="hover:text-white underline-offset-4 hover:underline">{t.footer.privacy}</NavLink>
          <NavLink to="/terms" className="hover:text-white underline-offset-4 hover:underline">{t.footer.terms}</NavLink>
          <NavLink to="/delete-my-data" className="hover:text-white underline-offset-4 hover:underline">{t.footer.delete}</NavLink>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="section py-4 text-xs text-brand-100/60">{t.footer.rights}</p>
      </div>
    </footer>
  )
}

/** Public layout: header + page + footer, scroll-to-top and privacy-friendly page count. */
export default function Layout({ minimal = false }: { minimal?: boolean }) {
  const { t } = useI18n()
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  useEffect(() => { trackPageView(pathname) }, [pathname])
  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-white focus:p-2">{t.skip}</a>
      <Header minimal={minimal} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
