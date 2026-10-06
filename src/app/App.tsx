import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { DemoBanner, Header } from './components'
import { SessionProvider } from './session'
import { useSession } from './sessionContext'
import { ChildForm } from './screens/ChildForm'
import { ChildPage } from './screens/ChildPage'
import { AddDocument, DocumentPage, Documents } from './screens/Documents'
import { Home } from './screens/Home'
import { ReadDocument } from './screens/ReadDocument'
import { Report } from './screens/Report'
import { DocumentSummary, GrowthSummary } from './screens/Summaries'
import { MeasurementForm } from './screens/MeasurementForm'
import { About, Settings } from './screens/Settings'
import { Unlock, Welcome } from './screens/Welcome'

function Screens() {
  const { mode } = useSession()
  if (mode === 'loading') return null
  if (mode === 'welcome') return <Welcome />
  if (mode === 'locked') return <Unlock />
  return (
    <>
      <DemoBanner />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/child/new" element={<ChildForm />} />
        <Route path="/child/:id" element={<ChildPage />} />
        <Route path="/child/:id/edit" element={<ChildForm />} />
        <Route path="/child/:id/measure" element={<MeasurementForm />} />
        <Route path="/child/:id/measure/:mid" element={<MeasurementForm />} />
        <Route path="/child/:id/documents" element={<Documents />} />
        <Route path="/child/:id/documents/new" element={<AddDocument />} />
        <Route path="/child/:id/documents/:docId" element={<DocumentPage />} />
        <Route path="/child/:id/documents/:docId/read" element={<ReadDocument />} />
        <Route path="/child/:id/documents/:docId/summary" element={<DocumentSummary />} />
        <Route path="/child/:id/summary" element={<GrowthSummary />} />
        <Route path="/child/:id/report" element={<Report />} />
        {mode === 'unlocked' && <Route path="/settings" element={<Settings />} />}
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Screens />
      </BrowserRouter>
    </SessionProvider>
  )
}
