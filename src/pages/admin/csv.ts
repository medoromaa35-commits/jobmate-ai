import type { Applicant } from './Admin'
import {
  APPS_LAST_MONTH, HEARD_FROM, LOCATIONS, SALARY_RANGES, TARGET_ROLES, WILLING_TO_PAY, WORK_MODES, label, type Lang, type Option,
} from '../../content/options'

/** Quote a CSV cell and neutralize spreadsheet formula injection (=, +, -, @, tab, CR). */
function cell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

const many = (opts: Option[], vals: string[], lang: Lang) => vals.map((v) => label(opts, v, lang)).join('; ')

export function downloadCsv(rows: Applicant[], lang: Lang) {
  const cols: [string, (r: Applicant) => unknown][] = [
    ['id', (r) => r.id],
    ['created_at', (r) => r.created_at],
    ['status', (r) => r.status],
    ['full_name', (r) => r.full_name],
    ['email', (r) => r.email],
    ['mobile', (r) => r.mobile],
    ['current_job_title', (r) => r.current_job_title],
    ['years_experience', (r) => r.years_experience],
    ['current_industry', (r) => r.current_industry],
    ['target_roles', (r) => many(TARGET_ROLES, r.target_roles, lang)],
    ['preferred_locations', (r) => many(LOCATIONS, r.preferred_locations, lang)],
    ['preferred_location_other', (r) => r.preferred_location_other],
    ['max_commute_minutes', (r) => r.max_commute_minutes],
    ['work_modes', (r) => many(WORK_MODES, r.work_modes, lang)],
    ['min_salary_range', (r) => label(SALARY_RANGES, r.min_salary_range, lang)],
    ['linkedin_url', (r) => r.linkedin_url],
    ['applications_last_month', (r) => label(APPS_LAST_MONTH, r.applications_last_month, lang)],
    ['willing_to_pay', (r) => label(WILLING_TO_PAY, r.willing_to_pay, lang)],
    ['fair_price_egp', (r) => r.fair_price_egp],
    ['price_shown_egp', (r) => r.price_shown_egp],
    ['heard_from', (r) => label(HEARD_FROM, r.heard_from, lang)],
    ['heard_from_other', (r) => r.heard_from_other],
    ['language', (r) => r.language],
  ]
  const lines = [cols.map(([h]) => cell(h)).join(','), ...rows.map((r) => cols.map(([, f]) => cell(f(r))).join(','))]
  // BOM so Excel opens Arabic correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `jobmate-applicants-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
