// The app's frame: the app bar (a bottom tab bar on phones), the demo notice, the update banner, and
// the routes that only make sense for one child.

import { FileText, LayoutDashboard, LineChart, Lock, LogOut, Ruler, Settings, Share2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, ScrollRestoration, useNavigate, useParams } from 'react-router'
import { AppBar, Callout, type NavItem } from '../core/ui/components'
import { UpdatePrompt } from '../core/ui/UpdatePrompt'
import { APP, BRAND, childPath } from './brand'
import { useChild } from './data'
import { useSession } from './sessionContext'

/** The router's root: the update banner on every page, and scroll positions kept on back. */
export function Root() {
  const { mode } = useSession()
  return (
    <>
      <UpdatePrompt appName="BabyTrails" locksVault={mode === 'unlocked'} />
      <Outlet />
      <ScrollRestoration />
    </>
  )
}

export function Shell({ children, nav, narrow }: { children: ReactNode; nav?: NavItem[]; narrow?: boolean }) {
  const { mode, lock } = useSession()
  const navigate = useNavigate()
  const actions = (
    <>
      {mode === 'unlocked' && (
        <>
          <Link className="icon-button" to={`${APP}/settings`} aria-label="Settings" title="Settings">
            <Settings size={18} aria-hidden />
          </Link>
          <button className="button small" onClick={lock}>
            <Lock size={14} aria-hidden /> Lock
          </button>
        </>
      )}
      {mode === 'demo' && (
        // The landing page leaves the demo once it's showing; leaving here first would bounce these
        // screens into the app before the navigation lands.
        <button className="button small" onClick={() => void navigate('/', { state: { leaveDemo: true } })}>
          <LogOut size={14} aria-hidden /> Leave demo
        </button>
      )}
    </>
  )
  return (
    <div className={nav?.length ? 'has-tab-bar' : undefined}>
      <AppBar brand={BRAND} home={APP} nav={nav} actions={actions} />
      <main className="app-main">
        <div className={`container${narrow ? ' narrow' : ''}`}>
          {mode === 'demo' && (
            <div className="no-print">
              <Callout tone="accent">
                <strong>Demo.</strong> A made-up baby with made-up measurements. Nothing here is real, and nothing is saved.
              </Callout>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}

/** Screens for one child, with the child's sections in the app bar. */
export function ChildLayout() {
  const { id = '' } = useParams()
  const { store } = useSession()
  const child = useChild(id)
  if (!store) return <Navigate to={APP} replace />
  if (child === undefined) {
    return (
      <Shell>
        <div className="skeleton loading-title" />
        <div className="metric-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton loading-card" />
          ))}
        </div>
      </Shell>
    )
  }
  if (child === null) {
    return (
      <Shell>
        <h1>Not found</h1>
        <p>This child isn't in your records.</p>
        <Link to={APP}>Back to the start</Link>
      </Shell>
    )
  }
  const nav: NavItem[] = [
    { to: childPath(id), label: 'Overview', icon: LayoutDashboard, end: true },
    { to: childPath(id, 'charts'), label: 'Charts', icon: LineChart },
    { to: childPath(id, 'measurements'), label: 'Measurements', icon: Ruler },
    { to: childPath(id, 'documents'), label: 'Documents', icon: FileText },
    { to: childPath(id, 'share'), label: 'Share', icon: Share2 },
  ]
  return (
    <Shell nav={nav}>
      <Outlet />
    </Shell>
  )
}

/** Addresses from before the app moved under /app keep working. */
export function LegacyChild() {
  const { id = '', '*': rest = '' } = useParams()
  const mapped = rest
    .replace(/^measure\/(.+)$/, 'measurements/$1')
    .replace(/^measure$/, 'measurements/new')
    .replace(/^report$/, 'share')
  return <Navigate to={childPath(id, mapped)} replace />
}

/** The old one-document reading screen now opens the import with that document. */
export function ReadLegacy() {
  const { id = '', docId = '' } = useParams()
  return <Navigate to={childPath(id, `documents/import?documents=${docId}`)} replace />
}
