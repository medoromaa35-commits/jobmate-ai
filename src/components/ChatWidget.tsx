import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { SUPPORT_EMAIL } from '../config'

type Action = 'apply' | 'pricing' | 'checkout' | 'privacy' | 'delete_data' | 'contact_human'
type Msg = { role: 'user' | 'assistant'; content: string; actions?: Action[] }

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const ROUTES: Record<Exclude<Action, 'contact_human'>, string> = {
  apply: '/consent', pricing: '/pricing', checkout: '/checkout', privacy: '/privacy', delete_data: '/delete-my-data',
}

/** Floating website assistant. Conversation lives only in this tab's memory. */
export default function ChatWidget() {
  const { t, lang } = useI18n()
  const C = t.chat
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs, busy])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!URL_ || !KEY) return null

  async function send(text: string) {
    const q = text.trim().slice(0, 1500)
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch(`${URL_}/functions/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY! },
        body: JSON.stringify({ lang, messages: next.slice(-20).map(({ role, content }) => ({ role, content })) }),
      })
      const data = (await res.json()) as { reply?: string; actions?: Action[] }
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply || C.error, actions: data.actions ?? [] }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: C.error, actions: ['contact_human'] }])
    } finally {
      setBusy(false)
    }
  }

  function act(a: Action) {
    if (a === 'contact_human') { window.location.href = `mailto:${SUPPORT_EMAIL}`; return }
    setOpen(false)
    nav(ROUTES[a])
  }

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={C.open}
          className="fixed bottom-4 end-4 z-40 flex h-14 items-center gap-2 rounded-full bg-brand-800 px-5 text-white shadow-lg ring-4 ring-white/60 hover:bg-brand-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
          <span className="hidden sm:inline font-semibold">{C.title}</span>
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="false" aria-labelledby="chat-title"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col bg-paper shadow-2xl sm:inset-x-auto sm:bottom-4 sm:end-4 sm:h-[600px] sm:max-h-[85dvh] sm:w-[380px] sm:rounded-2xl sm:ring-1 sm:ring-line rounded-t-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-brand-800 px-4 py-3 text-white">
            <div>
              <p id="chat-title" className="font-bold">{C.title}</p>
              <p className="text-xs text-brand-100">{C.subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={C.close}
              className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            <Bubble role="assistant">{C.welcome}</Bubble>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {C.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)}
                    className="rounded-full bg-white px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i}>
                <Bubble role={m.role}>{m.content}</Bubble>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <button key={a} type="button" onClick={() => act(a)}
                        className={`rounded-full px-3 py-2 text-sm font-semibold ${a === 'checkout' || a === 'apply' ? 'bg-accent text-brand-900' : 'bg-white text-brand-800 ring-1 ring-brand-100'} hover:opacity-90`}>
                        {C.actions[a]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <Bubble role="assistant"><span className="text-muted">{C.thinking}</span></Bubble>}
          </div>

          <form className="border-t border-line bg-white p-3" onSubmit={(e) => { e.preventDefault(); void send(input) }}>
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">{C.placeholder}</label>
              <textarea id="chat-input" ref={inputRef} rows={1} value={input} maxLength={1500} placeholder={C.placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
                className="input !min-h-11 max-h-28 resize-none !py-2.5" />
              <button type="submit" disabled={busy || !input.trim()} aria-label={C.send}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-800 text-white disabled:opacity-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted">{C.disclaimer}</p>
          </form>
        </div>
      )}
    </>
  )
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${role === 'user' ? 'bg-brand-800 text-white rounded-ee-md' : 'bg-white ring-1 ring-line rounded-es-md'}`}>
        {children}
      </div>
    </div>
  )
}
