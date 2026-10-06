import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { DemoBanner, Header } from './components'
import { SessionProvider } from './session'
import { useSession } from './sessionContext'
import { ChildForm } from './screens/ChildForm'
import { ChildPage } from './screens/ChildPage'
import { Home } from './screens/Home'
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
