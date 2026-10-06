import { Link, Navigate } from 'react-router'
import { Disclaimer, Page } from '../components'
import { useChildren } from '../data'
import { formatAge } from '../format'
import { today } from '../types'
import { BackupNudge } from './Settings'

export function Home() {
  const children = useChildren()
  if (children === null) return null
  // One child (the usual case, and the demo): go straight to their page.
  if (children.length === 1) return <Navigate to={`/child/${children[0].id}`} replace />

  return (
    <Page title={children.length ? 'Your children' : 'Welcome'}>
      <BackupNudge />
      {children.length === 0 && <p>Start by adding your baby. You can add more children later.</p>}
      <ul className="child-list">
        {children.map((c) => (
          <li key={c.id} className="card">
            <Link to={`/child/${c.id}`} className="child-link">
              <strong>{c.nickname || c.name}</strong>
              <span className="muted">{formatAge(c.dateOfBirth, today())}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/child/new" className="button primary">
        Add a child
      </Link>
      <Disclaimer />
    </Page>
  )
}
