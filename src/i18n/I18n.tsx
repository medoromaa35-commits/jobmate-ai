import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { STRINGS, type Dict } from './strings'
import type { Lang } from '../content/options'

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void; toggle: () => void }
const I18nCtx = createContext<Ctx | null>(null)

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'en' || q === 'ar') return q
    const s = localStorage.getItem('jm_lang')
    if (s === 'en' || s === 'ar') return s
  } catch { /* storage unavailable */ }
  return 'ar' // Arabic by default
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try { localStorage.setItem('jm_lang', lang) } catch { /* ignore */ }
  }, [lang])

  const value = useMemo<Ctx>(
    () => ({ lang, t: STRINGS[lang], setLang, toggle: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')) }),
    [lang],
  )
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) throw new Error('useI18n outside provider')
  return c
}
