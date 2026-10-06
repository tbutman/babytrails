import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from './sessionContext'

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`wordmark wordmark-${size}`}>
      baby<span className="wordmark-accent">trails</span>
    </span>
  )
}

export function Header() {
  const { mode, lock, exitDemo } = useSession()
  return (
    <header className="app-header">
      <Link to="/" className="home-link" aria-label="BabyTrails home">
        <Wordmark />
      </Link>
      <nav className="header-actions">
        {mode === 'unlocked' && (
          <>
            <Link to="/settings" className="button ghost small">
              Settings
            </Link>
            <button className="button ghost small" onClick={lock}>
              Lock
            </button>
          </>
        )}
        {mode === 'demo' && (
          <button className="button ghost small" onClick={exitDemo}>
            Leave demo
          </button>
        )}
      </nav>
    </header>
  )
}

export function DemoBanner() {
  const { mode } = useSession()
  if (mode !== 'demo') return null
  return (
    <div className="demo-banner" role="status">
      <strong>Demo:</strong> a made-up baby with made-up data. Nothing you do here is saved.
    </div>
  )
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? 'disclaimer compact' : 'disclaimer'}>
      BabyTrails keeps records and draws charts. It isn't medical advice and can't tell you whether your
      baby is healthy. Talk to your paediatrician about anything that worries you.
    </p>
  )
}

export function Page({ title, children, back }: { title?: string; children: ReactNode; back?: string }) {
  return (
    <main className="page">
      {back && (
        <Link to={back} className="back-link">
          ← Back
        </Link>
      )}
      {title && <h1>{title}</h1>}
      {children}
    </main>
  )
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
