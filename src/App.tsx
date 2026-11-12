import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18n'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Consent from './pages/Consent'
import Apply from './pages/Apply'
import ThankYou from './pages/ThankYou'
import DeleteData from './pages/DeleteData'
import { NotFound, Privacy, Terms } from './pages/Legal'

const Admin = lazy(() => import('./pages/admin/Admin'))

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="delete-my-data" element={<DeleteData />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<Layout minimal />}>
            <Route path="consent" element={<Consent />} />
            <Route path="apply" element={<Apply />} />
            <Route path="thank-you" element={<ThankYou />} />
          </Route>
          <Route path="admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
