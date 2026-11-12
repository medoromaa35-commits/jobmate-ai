// Option values are stored in the DB; labels are bilingual. Keep values in sync with
// the CHECK constraints in supabase/migrations.
export type Lang = 'ar' | 'en'
export type Option = { value: string; ar: string; en: string }

export const TARGET_ROLES: Option[] = [
  { value: 'hr_generalist', ar: 'HR Generalist', en: 'HR Generalist' },
  { value: 'hr_operations', ar: 'HR Operations / شؤون العاملين', en: 'HR Operations' },
  { value: 'recruitment_ta', ar: 'Recruitment / Talent Acquisition', en: 'Recruitment / TA' },
  { value: 'comp_ben', ar: 'Compensation & Benefits', en: 'Compensation & Benefits' },
  { value: 'payroll', ar: 'Payroll / رواتب', en: 'Payroll' },
  { value: 'training_development', ar: 'Training & Development / تدريب', en: 'Training & Development' },
  { value: 'od', ar: 'Organizational Development (OD)', en: 'Organizational Development (OD)' },
  { value: 'hrbp', ar: 'HR Business Partner (HRBP)', en: 'HR Business Partner (HRBP)' },
  { value: 'hr_manager', ar: 'HR Manager / مدير موارد بشرية', en: 'HR Manager' },
]

export const LOCATIONS: Option[] = [
  { value: 'new_cairo', ar: 'القاهرة الجديدة / التجمع', en: 'New Cairo' },
  { value: 'nasr_city', ar: 'مدينة نصر', en: 'Nasr City' },
  { value: 'downtown', ar: 'وسط البلد', en: 'Downtown' },
  { value: 'maadi', ar: 'المعادي', en: 'Maadi' },
  { value: 'october', ar: '6 أكتوبر', en: '6th of October' },
  { value: 'sheikh_zayed', ar: 'الشيخ زايد', en: 'Sheikh Zayed' },
  { value: 'giza', ar: 'الجيزة', en: 'Giza' },
  { value: 'smart_village', ar: 'القرية الذكية', en: 'Smart Village' },
  { value: 'tenth_ramadan', ar: 'العاشر من رمضان', en: '10th of Ramadan' },
  { value: 'obour', ar: 'العبور', en: 'Obour' },
  { value: 'alexandria', ar: 'الإسكندرية', en: 'Alexandria' },
  { value: 'other', ar: 'مكان آخر', en: 'Other' },
]

export const WORK_MODES: Option[] = [
  { value: 'onsite', ar: 'من المكتب', en: 'Onsite' },
  { value: 'hybrid', ar: 'هجين', en: 'Hybrid' },
  { value: 'remote', ar: 'عن بُعد', en: 'Remote' },
]

export const COMMUTE: Option[] = [
  { value: '30', ar: 'حتى 30 دقيقة', en: 'Up to 30 min' },
  { value: '45', ar: 'حتى 45 دقيقة', en: 'Up to 45 min' },
  { value: '60', ar: 'حتى ساعة', en: 'Up to 1 hour' },
  { value: '90', ar: 'حتى ساعة ونص', en: 'Up to 1.5 hours' },
  { value: '120', ar: 'أكتر من ساعة ونص', en: 'More than 1.5 hours' },
]

export const SALARY_RANGES: Option[] = [
  { value: 'lt_10k', ar: 'أقل من 10,000 ج.م', en: 'Under EGP 10,000' },
  { value: '10_15k', ar: '10,000 – 15,000 ج.م', en: 'EGP 10,000 – 15,000' },
  { value: '15_20k', ar: '15,000 – 20,000 ج.م', en: 'EGP 15,000 – 20,000' },
  { value: '20_30k', ar: '20,000 – 30,000 ج.م', en: 'EGP 20,000 – 30,000' },
  { value: '30_45k', ar: '30,000 – 45,000 ج.م', en: 'EGP 30,000 – 45,000' },
  { value: '45_60k', ar: '45,000 – 60,000 ج.م', en: 'EGP 45,000 – 60,000' },
  { value: '60_80k', ar: '60,000 – 80,000 ج.م', en: 'EGP 60,000 – 80,000' },
  { value: '80k_plus', ar: 'أكتر من 80,000 ج.م', en: 'Over EGP 80,000' },
]

export const APPS_LAST_MONTH: Option[] = [
  { value: '0', ar: 'ولا تقديم', en: 'None' },
  { value: '1_10', ar: '1 – 10', en: '1 – 10' },
  { value: '11_30', ar: '11 – 30', en: '11 – 30' },
  { value: '30_plus', ar: 'أكتر من 30', en: '30+' },
]

export const WILLING_TO_PAY: Option[] = [
  { value: 'yes', ar: 'أيوه', en: 'Yes' },
  { value: 'maybe_lower', ar: 'ممكن، بس بسعر أقل', en: 'Maybe, at a lower price' },
  { value: 'no', ar: 'لأ', en: 'No' },
]

export const HEARD_FROM: Option[] = [
  { value: 'linkedin', ar: 'LinkedIn', en: 'LinkedIn' },
  { value: 'facebook', ar: 'Facebook', en: 'Facebook' },
  { value: 'whatsapp', ar: 'جروب واتساب', en: 'WhatsApp group' },
  { value: 'friend', ar: 'صديق أو زميل', en: 'A friend or colleague' },
  { value: 'hr_community', ar: 'مجتمع / فعالية HR', en: 'HR community or event' },
  { value: 'other', ar: 'حاجة تانية', en: 'Other' },
]

export const STATUSES = ['new', 'accepted', 'waitlist', 'rejected', 'active', 'done'] as const
export type Status = (typeof STATUSES)[number]

export function label(opts: Option[], value: string | null | undefined, lang: Lang): string {
  const o = opts.find((x) => x.value === value)
  return o ? o[lang] : (value ?? '')
}
