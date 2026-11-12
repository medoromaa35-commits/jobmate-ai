import { CONSENTS, type ConsentKey } from '../content/consents'
import { CONSENT_VERSION } from '../config'
import type { Lang } from '../content/options'

// Consent choices are carried from the consent screen to the form in sessionStorage
// (cleared when the tab closes and after submission). They're only written to the DB
// together with the application.
export type ConsentState = Record<ConsentKey, { granted: boolean; at: string | null; lang: Lang | null }>
const KEY = 'jm_consent'

export function emptyConsent(): ConsentState {
  return Object.fromEntries(CONSENTS.map((c) => [c.key, { granted: false, at: null, lang: null }])) as ConsentState
}

export function loadConsent(): ConsentState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { version: string; state: ConsentState }
    return v.version === CONSENT_VERSION ? v.state : null
  } catch {
    return null
  }
}

export function saveConsent(state: ConsentState) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION, state })) } catch { /* ignore */ }
}

export function clearConsent() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function hasRequired(state: ConsentState | null): boolean {
  return !!state && CONSENTS.filter((c) => c.required).every((c) => state[c.key].granted)
}
