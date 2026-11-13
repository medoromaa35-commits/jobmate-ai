// ─────────────────────────────────────────────────────────────
//  Editable pilot constants
// ─────────────────────────────────────────────────────────────

/** Pilot Sprint price in EGP. Replace '[PRICE_TBD]' with a number (e.g. 499) when decided. */
export const PILOT_PRICE_EGP: string | number = '[PRICE_TBD]'

/** Length of the pilot sprint in days. */
export const PILOT_DAYS = 30

/** Fallback seat total shown if the database can't be reached. The real number lives in
 *  the `pilot_settings` table (total_seats) so it can be changed without a deploy. */
export const PILOT_SEATS_FALLBACK = 30

/** Bump this whenever ANY consent wording changes. It is stored with every consent record. */
export const CONSENT_VERSION = '2026-11-13.v2'

/** Max CV size in bytes (must match the storage bucket limit). */
export const CV_MAX_BYTES = 5 * 1024 * 1024

/** How fast we reply to applicants (business days). */
export const RESPONSE_DAYS = 3

/** Where people can reach a human about privacy. */
export const PRIVACY_EMAIL = 'privacy@jobmate.ai'

/** Support / human hand-off contact shown by the chatbot and on the pricing page. */
export const SUPPORT_EMAIL = PRIVACY_EMAIL

/** Online payment provider. null = no merchant account yet: checkout records an order request
 *  and the team sends a secure payment link manually. Set to 'paymob' or 'kashier' once integrated. */
export const PAYMENT_PROVIDER: null | 'paymob' | 'kashier' = null

/** Hours within which the team sends a payment link for an order request. */
export const PAYMENT_LINK_HOURS = 24
