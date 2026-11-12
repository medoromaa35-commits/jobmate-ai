import { CV_MAX_BYTES } from '../config'

const ARABIC_DIGITS = /[٠-٩۰-۹]/g

/** Convert Arabic-Indic / Persian digits to ASCII so "٠١٠١٢٣٤٥٦٧٨" works. */
export function toAsciiDigits(s: string): string {
  return s.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
}

/**
 * Egyptian mobile numbers: 010 / 011 / 012 / 015 + 8 digits.
 * Accepts 01xxxxxxxxx, +201xxxxxxxxx, 00201xxxxxxxxx, 201xxxxxxxxx, with spaces/dashes.
 * Returns normalized E.164 (+201xxxxxxxxx) or null.
 */
export function normalizeEgyptMobile(input: string): string | null {
  let s = toAsciiDigits(input).replace(/[\s\-().]/g, '')
  if (s.startsWith('+')) s = s.slice(1)
  if (s.startsWith('00')) s = s.slice(2)
  if (s.startsWith('20')) s = s.slice(2)
  if (s.startsWith('0')) s = s.slice(1)
  return /^1[0125]\d{8}$/.test(s) ? `+20${s}` : null
}

export function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s.trim()) && s.trim().length <= 254
}

export function isLinkedIn(s: string): boolean {
  try {
    const u = new URL(s.trim())
    return /^https?:$/.test(u.protocol) && /(^|\.)linkedin\.com$/i.test(u.hostname)
  } catch {
    return false
  }
}

export type CvCheck = { ok: true; ext: 'pdf' | 'docx'; mime: string } | { ok: false; reason: 'type' | 'size' }

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function checkCv(file: File): Promise<CvCheck> {
  if (file.size > CV_MAX_BYTES) return { ok: false, reason: 'size' }
  const name = file.name.toLowerCase()
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  // Magic bytes: PDF = "%PDF", DOCX = ZIP "PK\x03\x04"
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (name.endsWith('.pdf') && isPdf) return { ok: true, ext: 'pdf', mime: 'application/pdf' }
  if (name.endsWith('.docx') && isZip) return { ok: true, ext: 'docx', mime: DOCX_MIME }
  return { ok: false, reason: 'type' }
}
