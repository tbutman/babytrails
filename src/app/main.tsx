import '../core/ui/tokens.css'
import '../core/ui/components.css'
import './accent.css'
import './app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { ChildLayout, LegacyChild, Root } from './Layout'
import { SessionProvider } from './session'
import { Charts } from './screens/Charts'
import { ChildForm } from './screens/ChildForm'
import { AddDocument, DocumentPage, Documents } from './screens/Documents'
import { Home } from './screens/Home'
import { Landing } from './screens/Landing'
import { MeasurementForm } from './screens/MeasurementForm'
import { Measurements } from './screens/Measurements'
import { Overview } from './screens/Overview'
import { ReadDocument } from './screens/ReadDocument'
import { Report } from './screens/Report'
import { About, Settings } from './screens/Settings'
import { DocumentSummary, GrowthSummary } from './screens/Summaries'

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/app', element: <Home /> },
      { path: '/app/settings', element: <Settings /> },
      { path: '/app/about', element: <About /> },
      { path: '/app/child/new', element: <ChildForm /> },
      {
        path: '/app/child/:id',
        element: <ChildLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'edit', element: <ChildForm /> },
          { path: 'charts', element: <Charts /> },
          { path: 'measurements', element: <Measurements /> },
          { path: 'measurements/new', element: <MeasurementForm /> },
          { path: 'measurements/:mid', element: <MeasurementForm /> },
          { path: 'documents', element: <Documents /> },
          { path: 'documents/new', element: <AddDocument /> },
          { path: 'documents/:docId', element: <DocumentPage /> },
          { path: 'documents/:docId/read', element: <ReadDocument /> },
          { path: 'documents/:docId/summary', element: <DocumentSummary /> },
          { path: 'summary', element: <GrowthSummary /> },
          { path: 'share', element: <Report /> },
        ],
      },
      // Addresses from before the landing page moved the app under /app.
      { path: '/child/new', element: <Navigate to="/app/child/new" replace /> },
      { path: '/child/:id/*', element: <LegacyChild /> },
      { path: '/settings', element: <Navigate to="/app/settings" replace /> },
      { path: '/about', element: <Navigate to="/app/about" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>,
)
