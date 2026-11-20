import { supabase } from '../../lib/supabase'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** Calls the admin-only `ai-admin` Edge Function with the signed-in admin's session token. */
export async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('not_signed_in')
  const res = await fetch(`${URL_}/functions/v1/ai-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const out = await res.json().catch(() => ({ error: `http_${res.status}` }))
  if (!res.ok) throw new Error(out.error ?? `http_${res.status}`)
  return out as T
}

/** Run async tasks with limited concurrency, reporting progress. */
export async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>, onDone?: (n: number) => void) {
  let i = 0, done = 0
  const worker = async () => {
    while (i < items.length) {
      const x = items[i++]
      try { await fn(x) } finally { onDone?.(++done) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
