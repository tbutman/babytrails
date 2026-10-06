import '../core/ui/tokens.css'
import '../core/ui/components.css'
import './accent.css'
import './app.css'

import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, type LazyRouteFunction, type RouteObject } from 'react-router'
import { ChildLayout, LegacyChild, ReadLegacy, Root } from './Layout'
import { SessionProvider } from './session'
import { Landing } from './screens/Landing'

// The landing page loads first and alone; each screen of the app is fetched when it's first opened
// (and precached by the service worker, so it works offline once the app has been visited).
const screen =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M): LazyRouteFunction<RouteObject> =>
  async () => ({ Component: (await load())[name] as ComponentType })

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/app', lazy: screen(() => import('./screens/Home'), 'Home') },
      { path: '/app/settings', lazy: screen(() => import('./screens/Settings'), 'Settings') },
      { path: '/app/about', lazy: screen(() => import('./screens/Settings'), 'About') },
      { path: '/app/child/new', lazy: screen(() => import('./screens/ChildForm'), 'ChildForm') },
      {
        path: '/app/child/:id',
        element: <ChildLayout />,
        children: [
          { index: true, lazy: screen(() => import('./screens/Overview'), 'Overview') },
          { path: 'edit', lazy: screen(() => import('./screens/ChildForm'), 'ChildForm') },
          { path: 'charts', lazy: screen(() => import('./screens/Charts'), 'Charts') },
          { path: 'measurements', lazy: screen(() => import('./screens/Measurements'), 'Measurements') },
          { path: 'measurements/new', lazy: screen(() => import('./screens/MeasurementForm'), 'MeasurementForm') },
          { path: 'measurements/:mid', lazy: screen(() => import('./screens/MeasurementForm'), 'MeasurementForm') },
          { path: 'documents', lazy: screen(() => import('./screens/Documents'), 'Documents') },
          { path: 'documents/import', lazy: screen(() => import('./screens/ImportDocuments'), 'ImportDocuments') },
          // The single-document screens before the shared import; their addresses still work.
          { path: 'documents/new', element: <Navigate to="../import" relative="path" replace /> },
          { path: 'documents/:docId', lazy: screen(() => import('./screens/Documents'), 'DocumentPage') },
          { path: 'documents/:docId/read', element: <ReadLegacy /> },
          { path: 'documents/:docId/summary', lazy: screen(() => import('./screens/Summaries'), 'DocumentSummary') },
          { path: 'summary', lazy: screen(() => import('./screens/Summaries'), 'GrowthSummary') },
          { path: 'ask', lazy: screen(() => import('./screens/Ask'), 'Ask') },
          { path: 'share', lazy: screen(() => import('./screens/Report'), 'Report') },
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
