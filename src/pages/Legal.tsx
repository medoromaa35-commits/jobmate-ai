import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18n'
import { Alert } from '../components/ui'
import { PRIVACY_EMAIL } from '../config'

// PLACEHOLDER legal pages. Replace with reviewed text before launch.
// Draft references Egypt's Personal Data Protection Law No. 151 of 2020.

const PRIVACY = {
  ar: {
    title: 'سياسة الخصوصية',
    sections: [
      ['مين إحنا', 'JobMate AI هي خدمة تجريبية (Pilot) بتساعد محترفي الموارد البشرية في مصر يلاقوا وظائف مناسبة.'],
      ['البيانات اللي بنجمعها', 'الاسم، الإيميل، رقم الموبايل، المسمّى الوظيفي، سنين الخبرة، المجال، تفضيلات الشغل والمرتب، الـ CV، ولينك LinkedIn لو حبيت. مش بنجمع رقم قومي، تاريخ ميلاد، نوع، ديانة، حالة اجتماعية أو صور.'],
      ['ليه بنجمعها', 'عشان نرشّحلك وظائف ونقيّمها ونظبط الـ CV بتاعك، ونتواصل معاك بخصوص الـ Pilot — وده بناءً على موافقتك الصريحة.'],
      ['الذكاء الاصطناعي', 'بموافقتك، بنستخدم Claude من شركة Anthropic لتحليل الـ CV وتقييم الوظائف وتجهيز CV مخصّص. فريقنا بيراجع النتايج، والذكاء الاصطناعي مش بياخد قرارات لوحده، وإنت بتوافق على أي CV قبل استخدامه. Anthropic مش بتستخدم البيانات دي لتدريب نماذجها.'],
      ['مساعد الموقع (الشات)', 'المساعد بيرد بالذكاء الاصطناعي على أسئلة عن الخدمة. مش بنسجّل المحادثات؛ بنحتفظ بس بعدّاد رسائل مرتبط بنسخة مشفّرة من عنوان الـ IP لمدة أقصاها يومين لمنع الإساءة. ماتكتبش بيانات حساسة في الشات.'],
      ['مين يشوفها', 'فريق JobMate بس. مش بنبيع بياناتك، ومش بنبعت الـ CV لأي صاحب شغل من غير إذنك لكل وظيفة.'],
      ['مزوّدي الخدمة', 'Supabase (قاعدة البيانات والتخزين)، Anthropic (الذكاء الاصطناعي)، GitHub Pages (استضافة الموقع)، وبوابة دفع مصرية معتمدة عند الدفع. مش بنستقبل بيانات الكروت.'],
      ['فين بتتخزّن', 'على خوادم مزوّد سحابي (Supabase) خارج مصر، مشفّرة. الـ CV في مساحة تخزين خاصة، والوصول ليه بروابط مؤقتة بس.'],
      ['مدة الاحتفاظ', 'لحد نهاية الـ Pilot + 6 شهور، أو لحد ما تطلب المسح — أيهما أقرب.'],
      ['حقوقك', 'تقدر تطلب نسخة من بياناتك، تصحيحها، أو مسحها، أو تسحب أي موافقة اختيارية في أي وقت.'],
      ['التواصل', `ابعتلنا على ${PRIVACY_EMAIL}`],
    ],
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      ['Who we are', 'JobMate AI is a pilot service that helps HR professionals in Egypt find suitable jobs.'],
      ['Data we collect', 'Name, email, mobile number, job title, years of experience, industry, job and salary preferences, your CV, and optionally your LinkedIn URL. We do not collect national ID, date of birth, gender, religion, marital status or photos.'],
      ['Why we collect it', 'To shortlist and assess jobs for you, tailor your CV, and contact you about the pilot — based on your explicit consent.'],
      ['Artificial intelligence', 'With your consent, we use Claude by Anthropic to analyze your CV, assess jobs and draft tailored CVs. Our team reviews the results, AI does not make decisions on its own, and you approve any CV before it’s used. Anthropic does not use this data to train its models.'],
      ['Website assistant (chat)', 'The assistant uses AI to answer questions about the service. We don’t store conversations; we keep only a message counter tied to a hashed version of your IP address for up to two days to prevent abuse. Don’t share sensitive information in the chat.'],
      ['Who sees it', 'Only the JobMate team. We don’t sell your data, and we never send your CV to an employer without your permission for that specific job.'],
      ['Service providers', 'Supabase (database and storage), Anthropic (AI), GitHub Pages (website hosting), and a licensed Egyptian payment gateway when you pay. We never receive card details.'],
      ['Where it’s stored', 'Encrypted, on a cloud provider’s servers (Supabase) outside Egypt. CVs are in a private storage bucket, accessible only through short-lived links.'],
      ['Retention', 'Until the end of the pilot plus 6 months, or until you ask us to delete it — whichever comes first.'],
      ['Your rights', 'You can request a copy, correction or deletion of your data, or withdraw any optional consent at any time.'],
      ['Contact', `Email ${PRIVACY_EMAIL}`],
    ],
  },
}

const TERMS = {
  ar: {
    title: 'الشروط والأحكام',
    sections: [
      ['الخدمة', 'الـ Pilot خدمة تجريبية محدودة. الترشيح والتقييم بيتعمل يدويًا من فريقنا.'],
      ['مفيش ضمان توظيف', 'بنعمل أحسن ما عندنا، بس مش بنضمن إنك تتعيّن في وظيفة معيّنة.'],
      ['التقديم والقبول', 'التقديم مجاني. القبول في الـ 30 مكان حسب مراجعة فريقنا، والباقي في قائمة الانتظار.'],
      ['الدفع', 'لو اتقبلت، هنعرض عليك سعر الـ Sprint قبل أي دفع، وإنت حر تقبل أو ترفض.'],
      ['مسؤوليتك', 'إن البيانات اللي بتبعتها صحيحة وتخصّك.'],
    ],
  },
  en: {
    title: 'Terms',
    sections: [
      ['The service', 'The pilot is a limited trial. Matching and assessment are done manually by our team.'],
      ['No job guarantee', 'We do our best, but we don’t guarantee you’ll be hired for any particular job.'],
      ['Applying & acceptance', 'Applying is free. The 30 seats are allocated after our team’s review; others join the waitlist.'],
      ['Payment', 'If accepted, we’ll show you the sprint price before any payment, and you’re free to accept or decline.'],
      ['Your responsibility', 'The information you submit must be accurate and your own.'],
    ],
  },
}

function LegalPage({ doc }: { doc: typeof PRIVACY }) {
  const { lang, t } = useI18n()
  const d = doc[lang]
  return (
    <div className="section max-w-2xl py-12">
      <h1 className="text-2xl sm:text-3xl font-bold">{d.title}</h1>
      <div className="mt-4"><Alert tone="warn">{t.legal.draft}</Alert></div>
      <div className="mt-6 space-y-6">
        {d.sections.map(([h, p]) => (
          <section key={h}>
            <h2 className="text-lg font-bold">{h}</h2>
            <p className="mt-1 text-ink/80">{p}</p>
          </section>
        ))}
      </div>
      <Link to="/" className="btn-ghost mt-10">{t.legal.back}</Link>
    </div>
  )
}

export const Privacy = () => <LegalPage doc={PRIVACY} />
export const Terms = () => <LegalPage doc={TERMS} />

export function NotFound() {
  const { t } = useI18n()
  return (
    <div className="section max-w-xl py-20 text-center">
      <h1 className="text-2xl font-bold">{t.notFound.title}</h1>
      <Link to="/" className="btn-primary mt-6">{t.notFound.home}</Link>
    </div>
  )
}
