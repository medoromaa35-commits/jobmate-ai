// JSON schemas for structured outputs. Keep CvProfile in sync with src/pages/admin/cvDocx.ts.

export type CvProfile = {
  headline: string
  summary: string
  experience: { title: string; company: string; location: string; start: string; end: string; bullets: string[] }[]
  education: { degree: string; institution: string; year: string }[]
  certifications: string[]
  skills: string[]
  languages: string[]
  achievements: string[]
}

const str = { type: 'string' }
const strArr = { type: 'array', items: str }

export const CV_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary', 'experience', 'education', 'certifications', 'skills', 'languages', 'achievements'],
  properties: {
    headline: str,
    summary: str,
    experience: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'company', 'location', 'start', 'end', 'bullets'],
        properties: { title: str, company: str, location: str, start: str, end: str, bullets: strArr },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['degree', 'institution', 'year'],
        properties: { degree: str, institution: str, year: str },
      },
    },
    certifications: strArr,
    skills: strArr,
    languages: strArr,
    achievements: strArr,
  },
}

export const MATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'verdict', 'summary', 'strengths', 'gaps', 'advice', 'seniority_fit', 'location_fit', 'salary_note'],
  properties: {
    score: { type: 'integer', description: '0-100' },
    verdict: { type: 'string', enum: ['strong', 'good', 'partial', 'weak'] },
    summary: { type: 'string', description: 'Two sentences: why this job fits or not.' },
    strengths: strArr,
    gaps: strArr,
    advice: { type: 'string', description: 'One or two concrete tips for applying.' },
    seniority_fit: { type: 'string', enum: ['below', 'match', 'above', 'unclear'] },
    location_fit: { type: 'string', enum: ['match', 'partial', 'no', 'unclear'] },
    salary_note: str,
  },
}

export const TAILOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tailored_cv', 'cover_letter', 'changes', 'warnings'],
  properties: {
    tailored_cv: CV_SCHEMA,
    cover_letter: str,
    changes: strArr,
    warnings: strArr,
  },
}
