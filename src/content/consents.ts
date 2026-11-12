import { CONSENT_VERSION } from '../config'
import type { Lang } from './options'

// The exact wording below is stored with each consent record, together with CONSENT_VERSION.
// If you change ANY text here, bump CONSENT_VERSION in src/config.ts.

export type ConsentKey =
  | 'process_profile'
  | 'cross_border'
  | 'contact_email'
  | 'contact_whatsapp'
  | 'anonymized_improvement'
  | 'marketing'

export type ConsentItem = {
  key: ConsentKey
  required: boolean
  title: Record<Lang, string>
  explain: Record<Lang, string>
}

export const CONSENTS: ConsentItem[] = [
  {
    key: 'process_profile',
    required: true,
    title: {
      ar: 'أوافق على معالجة السيرة الذاتية وبيانات ملفي لإيجاد وتقييم الوظائف المناسبة لي.',
      en: 'Process my CV and profile to find and assess suitable jobs.',
    },
    explain: {
      ar: 'فريقنا هيقرأ الـ CV وإجاباتك عشان يرشّحلك وظائف ويشرحلك ليه مناسبة — ده أساس الخدمة.',
      en: 'Our team reads your CV and answers to shortlist jobs and explain why they fit — this is the core of the service.',
    },
  },
  {
    key: 'cross_border',
    required: true,
    title: {
      ar: 'أوافق على تخزين ومعالجة بياناتي على خوادم خارج مصر.',
      en: 'My data may be stored and processed on servers outside Egypt.',
    },
    explain: {
      ar: 'بنستخدم مزوّد سحابي عالمي (Supabase) وخوادمه مش في مصر. البيانات مشفّرة، والـ CV في مساحة خاصة مقفولة، ومحدش يوصله غير فريقنا.',
      en: 'We use a global cloud provider (Supabase) whose servers are not in Egypt. Data is encrypted, your CV sits in a private locked bucket, and only our team can open it.',
    },
  },
  {
    key: 'contact_email',
    required: true,
    title: {
      ar: 'أوافق على التواصل معي بالإيميل بخصوص الـ Pilot.',
      en: 'Contact me by email about the pilot.',
    },
    explain: {
      ar: 'هنبعتلك على الإيميل نتيجة طلبك والوظائف المرشّحة وأي تحديثات — مش هنبعت إعلانات.',
      en: 'We email you your application result, shortlisted jobs and pilot updates — no ads.',
    },
  },
  {
    key: 'contact_whatsapp',
    required: false,
    title: {
      ar: 'أوافق على التواصل معي على واتساب.',
      en: 'Contact me on WhatsApp.',
    },
    explain: {
      ar: 'اختياري — أسرع للمتابعة اليومية خلال الـ Sprint. تقدر توقفه في أي وقت.',
      en: 'Optional — faster for day-to-day follow-up during the sprint. You can stop it anytime.',
    },
  },
  {
    key: 'anonymized_improvement',
    required: false,
    title: {
      ar: 'أوافق على استخدام بياناتي بعد إخفاء هويتي لتحسين الخدمة.',
      en: 'Use my anonymized data to improve the service.',
    },
    explain: {
      ar: 'اختياري — بنشيل اسمك وأي حاجة تعرّف بيك، ونستخدم الأرقام العامة بس (زي أكتر الأدوار المطلوبة).',
      en: 'Optional — we strip your name and anything identifying, and use only aggregate patterns (e.g. most-wanted roles).',
    },
  },
  {
    key: 'marketing',
    required: false,
    title: {
      ar: 'أوافق على استلام رسائل تسويقية.',
      en: 'Send me marketing messages.',
    },
    explain: {
      ar: 'اختياري — أخبار عن المنتج وعروض بعد الـ Pilot. مش هيأثر على قبولك.',
      en: 'Optional — product news and offers after the pilot. It does not affect your application.',
    },
  },
]

export type ConsentRecord = {
  key: ConsentKey
  granted: boolean
  version: string
  text: string
  language: Lang
  granted_at: string
}

/** `lang` = the language the consent screen was shown in when the box was (un)ticked. */
export function buildConsentRecords(
  state: Record<ConsentKey, { granted: boolean; at: string | null; lang: Lang | null }>,
  fallbackLang: Lang,
): ConsentRecord[] {
  return CONSENTS.map((c) => {
    const lang = state[c.key].lang ?? fallbackLang
    return {
      key: c.key,
      granted: state[c.key].granted,
      version: CONSENT_VERSION,
      text: `${c.title[lang]} — ${c.explain[lang]}`,
      language: lang,
      granted_at: state[c.key].at ?? new Date().toISOString(),
    }
  })
}
