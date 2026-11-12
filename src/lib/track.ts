import { supabase } from './supabase'

/** Privacy-friendly page count: path only — no cookies, IP, user agent or IDs. Once per tab per path. */
export function trackPageView(path: string) {
  if (!supabase) return
  try {
    const k = `jm_pv_${path}`
    if (sessionStorage.getItem(k)) return
    sessionStorage.setItem(k, '1')
  } catch { /* ignore */ }
  supabase.rpc('track_page_view', { p_path: path }).then(() => {}, () => {})
}
