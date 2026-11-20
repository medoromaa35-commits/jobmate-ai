import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'

// Same shape as supabase/functions/ai-admin/schemas.ts → CvProfile
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
export type CvContact = { name: string; email: string; mobile: string; location?: string; linkedin?: string | null }

const FONT = 'Calibri'
const heading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0F3D3E', space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: '0F3D3E', font: FONT })],
  })
const para = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, font: FONT, size: opts.size ?? 21, bold: opts.bold, italics: opts.italics })] })
const bullet = (text: string) =>
  new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, font: FONT, size: 21 })] })

/** ATS-friendly single-column CV. No photo, no tables, no personal identifiers beyond contact details. */
export async function buildCvDocx(cv: CvProfile, contact: CvContact): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: contact.name, bold: true, size: 36, font: FONT, color: '0F3D3E' })] }),
  ]
  if (cv.headline) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: cv.headline, size: 24, font: FONT })] }))
  const line = [contact.location, contact.mobile, contact.email, contact.linkedin].filter(Boolean).join('  |  ')
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: line, size: 19, font: FONT, color: '52656B' })] }))

  if (cv.summary) { children.push(heading('Professional Summary'), para(cv.summary)) }
  if (cv.skills.length) { children.push(heading('Core Skills'), para(cv.skills.join('  •  '))) }
  if (cv.experience.length) {
    children.push(heading('Professional Experience'))
    for (const e of cv.experience) {
      children.push(new Paragraph({
        spacing: { before: 120, after: 20 },
        children: [
          new TextRun({ text: e.title, bold: true, size: 22, font: FONT }),
          new TextRun({ text: e.company ? ` — ${e.company}` : '', size: 22, font: FONT }),
        ],
      }))
      const meta = [e.location, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join('  |  ')
      if (meta) children.push(para(meta, { italics: true, size: 19 }))
      e.bullets.forEach((b) => children.push(bullet(b)))
    }
  }
  if (cv.achievements.length) { children.push(heading('Key Achievements')); cv.achievements.forEach((a) => children.push(bullet(a))) }
  if (cv.education.length) {
    children.push(heading('Education'))
    cv.education.forEach((ed) => children.push(para([ed.degree, ed.institution, ed.year].filter(Boolean).join(' — '))))
  }
  if (cv.certifications.length) { children.push(heading('Certifications')); cv.certifications.forEach((c) => children.push(bullet(c))) }
  if (cv.languages.length) { children.push(heading('Languages'), para(cv.languages.join('  •  '))) }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }],
  })
  return Packer.toBlob(doc)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
