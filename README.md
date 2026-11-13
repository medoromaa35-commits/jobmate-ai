# JobMate AI — Phase 0 pilot site

Concierge pilot: collects applicants for a 30-seat pilot. No AI, no job feed. Matching is done manually.
Arabic (RTL) by default, with an EN toggle. Built with Vite, React, Tailwind and Supabase.

## Pages
| Route | What |
|---|---|
| `/` | Landing: hero + live seats (x of 30), how it works, who it's for, bring-your-own-job, pricing teaser, privacy promise, FAQ |
| `/consent` | Separate consent step: 3 required + 3 optional, each with its own checkbox |
| `/apply` | 5-step form with progress bar; becomes the waitlist automatically when seats are full |
| `/thank-you` | What happens next + link to request deletion (separate copy for waitlist) |
| `/delete-my-data` | Email + reason → creates a deletion request |
| `/privacy`, `/terms` | Placeholder legal text (marked as draft) |
| `/admin` | Supabase Auth, admin role only: applicants, deletion requests, stats |

## Setup
1. Create a Supabase project. Then, in the SQL editor, run `supabase/migrations/20261112000000_phase0_pilot.sql`
   (or run `supabase db push`). This creates the tables, RLS, functions and the private `cvs` bucket.
2. `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`
4. **Create an admin:** Authentication → Users → *Add user* (email + password). Then run:
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
   where email = 'you@example.com';
   ```
   The user must sign out and back in to pick up the role. Only the service role can set `app_metadata`.
   Users can't set it themselves.
5. In Authentication → Providers, **turn off public sign-ups** (only invited admins need accounts).
6. Deploy `dist/` (`npm run build`) to Netlify, Vercel or Cloudflare Pages. SPA rewrites are already included.

## Editable things
- **Price:** `PILOT_PRICE_EGP` in `src/config.ts` (currently `'[PRICE_TBD]'`). The price each applicant saw is stored in `price_shown_egp`.
- **Seat count:** stored in the DB (`pilot_settings.total_seats`) and editable from Admin → Stats. No deploy needed.
- **Consent wording:** `src/content/consents.ts`. **Bump `CONSENT_VERSION`** in `src/config.ts` whenever you change it.
- **All copy (AR + EN):** `src/i18n/strings.ts`. Admin copy is in `src/pages/admin/adminStrings.ts`.

## Data & privacy design
- **No sensitive fields:** there are no columns for national ID, DOB, gender, religion, marital status or photo.
- **RLS on every table.** The anon role has no SELECT/UPDATE/DELETE anywhere. It can only:
  - upload one file to `cvs/<uuid>/cv.(pdf|docx)` (no read, list or overwrite);
  - call `submit_application()`. This is the only way to create an applicant. It checks the 3 required consents
    and checks that the CV exists in the applicant's own folder. It rejects duplicate emails, assigns `new` or `waitlist`
    under a lock so seat 30 can't be given out twice, and writes the applicant and the 6 consent rows in one transaction;
  - insert a `pending` deletion request (it can't read it back).
- **Consents:** each consent is stored as its own row, granted or declined, with the exact text shown, its language, `consent_version`,
  the client tick time and the server record time.
- **CVs:** the bucket is private, with a 5 MB limit and PDF/DOCX MIME types only. The browser also checks file magic bytes.
  Admins download through 60-second signed URLs.
- **Seats taken** = applicants with status `new`, `accepted`, `active` or `done`. Rejecting someone frees a seat.
- **Delete all data:** removes the CV files through the Storage API, then calls `admin_complete_deletion()`. That deletes the
  applicant rows (consents and notes cascade), closes the request and replaces the email with its SHA-256 as proof of deletion.
- **Abandoned uploads:** Admin → Deletion requests → *Clean up abandoned CV uploads*. This removes CVs older than 24h that no application references.
- **Analytics:** `track_page_view()` stores only (path, day, count). There are no cookies, IPs or user agents, and it accepts only whitelisted paths.
- **Spam:** a honeypot field, plus DB CHECK constraints on every field.

## Tests
`supabase/tests/run.sh` (run as a Postgres superuser, e.g. `sudo -u postgres`) applies the migration to a local DB
with a minimal Supabase stub and checks RLS and behaviour. It covers anon isolation, upload path rules, required consents,
the seat→waitlist switch, duplicate emails, admin vs non-admin access and deletion cascade + redaction.

## Phase 1: chatbot, pricing/checkout, AI consent
- **AI consent:** a new required consent, `ai_processing`, was added. `CONSENT_VERSION` was bumped to `2026-11-13.v2`, and the server now requires 4 consents.
- **Chatbot:** Supabase Edge Function `supabase/functions/chat`, using Claude `claude-opus-5-5` at low effort with refusal fallbacks enabled.
  - It answers only from `knowledge.ts` and suggests actions (apply / pricing / checkout / privacy / delete data / contact).
  - No transcripts are stored. Rate limits: 30 messages/hour per hashed IP and 2000 messages/day overall (`chat_rate_check`).
  - Needs the secret `ANTHROPIC_API_KEY` (Supabase → Edge Functions → Secrets). After you change `knowledge.ts` or the price, redeploy the function.
- **Pricing & checkout:** `/pricing` and `/checkout`. Until a payment provider is connected (`PAYMENT_PROVIDER` in `src/config.ts`), checkout saves an **order request** (`orders` table) and the team sends a payment link manually. Admin → Orders shows each request and tracks its status.
