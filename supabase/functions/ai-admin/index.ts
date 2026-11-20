// JobMate AI — admin AI actions (Supabase Edge Function, Deno).
//   parse_cv  { applicant_id }            → reads the CV from the private bucket, extracts a structured profile
//   match     { applicant_id, job_id }    → scores one job for one applicant, stores a `matches` row
//   tailor    { match_id }                → drafts a tailored CV + cover letter for that match (no invented facts)
// Only signed-in admins (app_metadata.role = 'admin') may call it. Contact details (name, email,
// phone) are never sent to the model; the CV parser is told not to extract personal identifiers.
//
// Secrets: ANTHROPIC_API_KEY (required), CHAT_ALLOWED_ORIGINS (optional, shared with `chat`).

import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import mammoth from 'npm:mammoth@1.12.3'
import { CV_SCHEMA, MATCH_SCHEMA, TAILOR_SCHEMA, type CvProfile } from './schemas.ts'

const MODEL = 'claude-opus-5-5'
const DEFAULT_ORIGINS = ['https://medoromaa35-commits.github.io', 'http://localhost:5173', 'http://localhost:4173']
const ALLOWED_ORIGINS = Deno.env.get('CHAT_ALLOWED_ORIGINS')?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ORIGINS

const anthropic = new Anthropic()
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } })

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg) } }

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** One structured-output call. Throws HttpError on refusal / truncation. */
async function ask<T>(system: string, content: Anthropic.Beta.BetaContentBlockParam[], schema: Record<string, unknown>,
  effort: 'low' | 'medium' | 'high', maxTokens: number): Promise<T> {
  const res = await anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
  }).finalMessage()
  if (res.stop_reason === 'refusal') throw new HttpError(422, 'model_refused')
  if (res.stop_reason === 'max_tokens') throw new HttpError(500, 'output_truncated')
  const text = res.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new HttpError(500, 'no_output')
  return JSON.parse(text.text) as T
}

// ─────────────────────────────── prompts ───────────────────────────────
const PARSE_SYSTEM = `You extract a structured profile from a CV for a career service for HR professionals in Egypt.
Rules:
- Copy facts exactly as written in the CV. Do not infer, embellish or add anything that is not in the CV.
- Keep the CV's original language for each field (usually English).
- Do NOT extract personal identifiers or sensitive data: name, email, phone, address, national ID, date of birth, age,
  gender, religion, marital status, military status, photo. Leave them out entirely.
- Dates: keep the CV's wording (e.g. "Jan 2019", "2019", "Present"). Use "" when missing.
- bullets: the CV's own achievement/responsibility lines for that role, lightly cleaned (no new content).`

const MATCH_SYSTEM = `You are a senior HR recruiter in Egypt assessing how well a candidate fits a job.
Be honest and specific; a weak fit must get a low score. Base everything ONLY on the candidate profile, the CV and the job text.
Score 0-100 using roughly: must-have requirements and seniority 50%, relevant experience and industry 25%,
skills/certifications 15%, location / work mode / commute 10%.
verdict: strong (80+), good (65-79), partial (45-64), weak (<45).
Write the summary, strengths, gaps and advice in {LANG}. Keep each item short (one line).
Never assume facts that are not stated. If salary is not in the job text, say it is not stated.`

const TAILOR_SYSTEM = `You tailor a candidate's CV to one specific job, for a career service in Egypt.
STRICT RULES (legal and ethical):
- Never invent or exaggerate: no new employers, titles, dates, degrees, certifications, numbers, tools or achievements.
- You may: rewrite the headline and summary for this job, reorder sections/bullets/skills by relevance, rephrase bullets
  to use the job's terminology when it truthfully describes the same work, and drop clearly irrelevant items.
- If the job needs something the CV does not show, do NOT add it — list it in "warnings" for a human to check.
- Keep the CV language the same as the original CV. Write the cover letter in the job ad's language (English if unsure),
  max 220 words, professional and specific, signed "[Name]" (the name is added later by our team).
- "changes": short list of what you changed and why, for the reviewer.
- Do not include personal identifiers (name, email, phone, national ID, DOB, marital status, photo).`

// ─────────────────────────────── actions ───────────────────────────────
async function parseCv(applicantId: string) {
  const { data: a, error } = await db.from('applicants').select('id, cv_path').eq('id', applicantId).single()
  if (error || !a) throw new HttpError(404, 'applicant_not_found')
  const { data: file, error: dErr } = await db.storage.from('cvs').download(a.cv_path)
  if (dErr || !file) throw new HttpError(404, 'cv_not_found')
  const bytes = new Uint8Array(await file.arrayBuffer())

  let content: Anthropic.Beta.BetaContentBlockParam[]
  if (a.cv_path.endsWith('.pdf')) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) } },
      { type: 'text', text: 'Extract the structured profile from this CV.' },
    ]
  } else {
    // deno-lint-ignore no-explicit-any
    const { value } = await (mammoth as any).extractRawText({ buffer: bytes })
    if (!value || value.trim().length < 50) throw new HttpError(422, 'cv_text_empty')
    content = [{ type: 'text', text: `<cv>\n${String(value).slice(0, 60000)}\n</cv>\nExtract the structured profile from this CV.` }]
  }
  const parsed = await ask<CvProfile>(PARSE_SYSTEM, content, CV_SCHEMA, 'low', 16000)
  const { error: upErr } = await db.from('cv_profiles').upsert({ applicant_id: a.id, cv_path: a.cv_path, parsed, model: MODEL })
  if (upErr) throw new HttpError(500, upErr.message)
  return { parsed }
}

async function loadCandidate(applicantId: string) {
  const { data: a } = await db.from('applicants')
    .select('id, language, current_job_title, years_experience, current_industry, target_roles, preferred_locations, preferred_location_other, max_commute_minutes, work_modes, min_salary_range')
    .eq('id', applicantId).single()
  if (!a) throw new HttpError(404, 'applicant_not_found')
  const { data: p } = await db.from('cv_profiles').select('parsed').eq('applicant_id', applicantId).maybeSingle()
  if (!p) throw new HttpError(409, 'cv_not_parsed')
  const { id: _id, language, ...prefs } = a
  return { language: language as 'ar' | 'en', prefs, cv: p.parsed as CvProfile }
}

async function matchJob(applicantId: string, jobId: string) {
  const c = await loadCandidate(applicantId)
  const { data: job } = await db.from('jobs').select('id, title, company, location, work_mode, description').eq('id', jobId).single()
  if (!job) throw new HttpError(404, 'job_not_found')
  const system = MATCH_SYSTEM.replace('{LANG}', c.language === 'ar' ? 'Egyptian Arabic (keep job titles and HR terms in English)' : 'English')
  const out = await ask<Record<string, unknown> & { score: number; verdict: string }>(system, [{
    type: 'text',
    text: `<candidate_preferences>\n${JSON.stringify(c.prefs)}\n</candidate_preferences>\n<cv>\n${JSON.stringify(c.cv)}\n</cv>\n<job>\n${JSON.stringify(job)}\n</job>`,
  }], MATCH_SCHEMA, 'medium', 8000)
  const score = Math.max(0, Math.min(100, Math.round(Number(out.score) || 0)))
  const { score: _s, verdict, ...analysis } = out
  const { data, error } = await db.from('matches').upsert(
    { applicant_id: applicantId, job_id: jobId, score, verdict, analysis, model: MODEL },
    { onConflict: 'applicant_id,job_id' },
  ).select('*').single()
  if (error) throw new HttpError(500, error.message)
  return { match: data }
}

async function tailor(matchId: string) {
  const { data: m } = await db.from('matches').select('id, applicant_id, job_id, analysis').eq('id', matchId).single()
  if (!m) throw new HttpError(404, 'match_not_found')
  const c = await loadCandidate(m.applicant_id)
  const { data: job } = await db.from('jobs').select('title, company, location, description').eq('id', m.job_id).single()
  const out = await ask<{ tailored_cv: CvProfile; cover_letter: string; changes: string[]; warnings: string[] }>(TAILOR_SYSTEM, [{
    type: 'text',
    text: `<original_cv>\n${JSON.stringify(c.cv)}\n</original_cv>\n<job>\n${JSON.stringify(job)}\n</job>\n<fit_analysis>\n${JSON.stringify(m.analysis)}\n</fit_analysis>`,
  }], TAILOR_SCHEMA, 'high', 32000)
  const { data, error } = await db.from('matches').update({
    tailored_cv: out.tailored_cv,
    cover_letter: out.cover_letter,
    changes: { changes: out.changes, warnings: out.warnings },
  }).eq('id', matchId).select('*').single()
  if (error) throw new HttpError(500, error.message)
  return { match: data }
}

// ─────────────────────────────── handler ───────────────────────────────
Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'forbidden_origin' }, 403, origin)

  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } }
    if ((u.user?.app_metadata as { role?: string } | undefined)?.role !== 'admin') throw new HttpError(403, 'admin_only')

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null
    switch (body.action) {
      case 'parse_cv': {
        const id = uuid(body.applicant_id); if (!id) throw new HttpError(400, 'bad_request')
        return json(await parseCv(id), 200, origin)
      }
      case 'match': {
        const a = uuid(body.applicant_id), j = uuid(body.job_id); if (!a || !j) throw new HttpError(400, 'bad_request')
        return json(await matchJob(a, j), 200, origin)
      }
      case 'tailor': {
        const id = uuid(body.match_id); if (!id) throw new HttpError(400, 'bad_request')
        return json(await tailor(id), 200, origin)
      }
      default: throw new HttpError(400, 'unknown_action')
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, origin)
    if (e instanceof Anthropic.AuthenticationError) { console.error('anthropic_auth_error'); return json({ error: 'anthropic_auth_error' }, 502, origin) }
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'anthropic_rate_limited' }, 429, origin)
    if (e instanceof Anthropic.APIError) { console.error('anthropic_api_error', e.status, e.message); return json({ error: 'anthropic_api_error' }, 502, origin) }
    console.error('ai_admin_error', String(e))
    return json({ error: 'internal_error' }, 500, origin)
  }
})
