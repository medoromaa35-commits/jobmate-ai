import type { Lang } from '../../content/options'

export type DraftJob = {
  title: string; company: string | null; location: string | null; url: string | null
  score: number | null; summary: string; strengths: string[]; gaps: string[]; hasCv: boolean
}

/** Plain-text email for the concierge pilot (sent manually now; via Resend later). */
export function buildEmailDraft(name: string, lang: Lang, jobs: DraftJob[]): { subject: string; body: string } {
  const first = name.trim().split(/\s+/)[0] || name
  if (lang === 'ar') {
    const blocks = jobs.map((j, i) => [
      `${i + 1}) ${j.title}${j.company ? ` — ${j.company}` : ''}${j.location ? ` (${j.location})` : ''}`,
      j.score != null ? `   نسبة التطابق: ${j.score}%` : '',
      j.summary ? `   ليه مناسبة: ${j.summary}` : '',
      j.strengths.length ? `   نقط قوتك: ${j.strengths.slice(0, 3).join('، ')}` : '',
      j.gaps.length ? `   خلي بالك من: ${j.gaps.slice(0, 2).join('، ')}` : '',
      j.hasCv ? '   ✅ جهزنالك CV مخصّص للوظيفة دي (مرفق) — راجعه قبل التقديم.' : '',
      j.url ? `   لينك التقديم: ${j.url}` : '',
    ].filter(Boolean).join('\n'))
    return {
      subject: `JobMate AI — ${jobs.length} وظائف مناسبة ليك الأسبوع ده`,
      body: [
        `أهلًا ${first}،`,
        '',
        'دي الوظائف اللي لقيناها وقيّمناها ليك الأسبوع ده:',
        '',
        blocks.join('\n\n'),
        '',
        'قدّم بنفسك من اللينك بعد ما تراجع الـ CV. لو عايز تعديل في أي CV أو عندك وظيفة لقيتها وعايزنا نقيّمها، رد على الإيميل ده.',
        '',
        'بالتوفيق،',
        'فريق JobMate AI',
        '',
        'لو مش عايز تستلم الإيميلات دي أو عايز تمسح بياناتك، رد بكلمة "إلغاء".',
      ].join('\n'),
    }
  }
  const blocks = jobs.map((j, i) => [
    `${i + 1}) ${j.title}${j.company ? ` — ${j.company}` : ''}${j.location ? ` (${j.location})` : ''}`,
    j.score != null ? `   Match: ${j.score}%` : '',
    j.summary ? `   Why it fits: ${j.summary}` : '',
    j.strengths.length ? `   Your strengths: ${j.strengths.slice(0, 3).join('; ')}` : '',
    j.gaps.length ? `   Watch out for: ${j.gaps.slice(0, 2).join('; ')}` : '',
    j.hasCv ? '   ✅ We prepared a tailored CV for this job (attached) — please review it before applying.' : '',
    j.url ? `   Apply here: ${j.url}` : '',
  ].filter(Boolean).join('\n'))
  return {
    subject: `JobMate AI — ${jobs.length} jobs that fit you this week`,
    body: [
      `Hi ${first},`, '', 'Here are the jobs we found and assessed for you this week:', '', blocks.join('\n\n'), '',
      'Apply yourself via the link after reviewing your CV. Reply to this email if you want changes to a CV or have a job you’d like us to assess.',
      '', 'Best of luck,', 'The JobMate AI team', '', 'To stop these emails or delete your data, reply "unsubscribe".',
    ].join('\n'),
  }
}
