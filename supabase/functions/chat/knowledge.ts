// The ONLY facts the chatbot may use. Keep in sync with src/config.ts and src/i18n/strings.ts.
// After editing, redeploy the `chat` Edge Function.

export const PRICE_EGP = '[PRICE_TBD]' // same value as PILOT_PRICE_EGP in src/config.ts
export const PILOT_DAYS = 30
export const RESPONSE_DAYS = 3
export const CONTACT_EMAIL = 'privacy@jobmate.ai'

export const KNOWLEDGE = `
# JobMate AI — facts (source of truth)

## What it is
- JobMate AI is an AI career agent for HR professionals in Egypt. Positioning: "Your AI Career Agent — not another job board" / "مساعدك الذكي في رحلة البحث عن وظيفة — مش موقع وظائف تاني".
- We do NOT post job ads. We work on the member's behalf: find suitable jobs, assess each one and explain why it fits (or not), tailor the CV for each job, and track applications.
- Current stage: a PILOT for 30 people. When the 30 seats are taken, new applicants join a waitlist with the same form.

## Who it is for
- HR professionals with 1–15 years of experience, in Cairo, Giza or Alexandria.
- Target roles: HR Generalist, HR Operations, Recruitment/Talent Acquisition, Compensation & Benefits, Payroll, Training & Development, Organizational Development (OD), HR Business Partner (HRBP), HR Manager.
- Others may still apply; the team decides case by case.

## How it works (3 steps)
1. Share your profile: apply on the website (consent step, then a 5-step form, CV upload as PDF or DOCX up to 5 MB).
2. We find and assess jobs that fit you and explain why.
3. We tailor your CV for each job and track your applications.
- "Bring your own job": members can send us any job link they found (LinkedIn, Wuzzuf, anywhere) and we assess it.
- The member always reviews and approves tailored CVs. The member applies themselves (we prepare everything). We never apply in someone's name without explicit approval for that specific job.
- We reply to applications by email within ${RESPONSE_DAYS} business days.

## Pricing & payment
- Plan: "Pilot Sprint" — ${PILOT_DAYS} days — ${PRICE_EGP} EGP. (If the price shows as [PRICE_TBD], say the final price will be announced soon and the team will confirm it before any payment.)
- Includes: assessed and explained job shortlists, assessment of any job the member sends, a tailored CV for each application, application tracking.
- Applying to the pilot is FREE and has no commitment. Payment happens only after acceptance, and the price is confirmed before paying.
- To pay: go to the Pricing page and press "Pay / Reserve". Leave name, email and mobile; the team sends a secure payment link. No card details are ever collected in the chat or on our forms.
- No job is guaranteed; we do our best to improve the member's chances.

## AI use
- We use AI tools (Anthropic's Claude) to help assess job fit and draft tailored CVs. Our team reviews the results; AI does not make decisions alone.
- Data sent to the AI provider is not used to train their models.
- This chat assistant is also AI. Chats are not stored by us.

## Privacy & security
- We collect: name, email, mobile, CV, job title, years of experience, industry, job/salary/location preferences, optional LinkedIn.
- We NEVER ask for national ID, date of birth, gender, religion, marital status or a photo. Applicants should remove photo, national ID and marital status from their CV.
- Data is encrypted and stored with Supabase (servers outside Egypt). CVs are in a private storage bucket; only our team can open them, via short-lived links.
- We don't sell data and don't send a CV to an employer without the member's permission for that specific job.
- Consents are separate and recorded: required (process profile, AI-assisted processing, storage outside Egypt, email contact) and optional (WhatsApp, anonymized improvement, marketing).
- Anyone can delete their data anytime from the "Delete my data" page; we delete the data and CV permanently (within 7 days).
- Retention: until the end of the pilot plus 6 months, or until deletion is requested.

## Contact
- Email: ${CONTACT_EMAIL}
`
