// The app's start (/app): set up a vault, unlock it, or pick a child. The landing page is at /.

import { ArchiveRestore, Baby, ChevronRight, HardDrive, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { checkPassphrase, KdfUnavailableError, takeErasedNotice, WeakPassphraseError, WrongPassphraseError } from '../../core'
import { RESTORED_MESSAGE, RestoreBackup } from '../../core/backup/BackupForms'
import { Callout, AppIcon, Checkbox, EmptyState, PageHeader, TextField } from '../../core/ui/components'
import { ForgotPassphrase, PassphraseStrength } from '../../core/vault/VaultForms'
import { APP, childPath } from '../brand'
import { Disclaimer } from '../components'
import { useChildren } from '../data'
import { DEMO_CHILD_ID } from '../demo'
import { formatAge } from '../format'
import { InstallHint } from '../InstallHint'
import { Shell } from '../Layout'
import { useSession } from '../sessionContext'
import { APP_ID, today } from '../types'
import { demoEndedByReload, forgetPlace, placeName, resumeAfterUnlock, savedPlace, takeResume } from '../place'
import { BackupNudge } from './Settings'

export function Home() {
  const { mode } = useSession()
  if (mode === 'loading') return <Shell narrow>{<div className="skeleton loading-card" />}</Shell>
  if (mode === 'demo') return <Navigate to={childPath(DEMO_CHILD_ID)} replace />
  if (mode === 'unlocked') {
    const resume = takeResume()
    return resume ? <Navigate to={resume} replace /> : <Children />
  }
  return <Auth />
}

function Auth() {
  const { mode, startDemo, trails, reload, setNotice } = useSession()
  const navigate = useNavigate()
  const [restoring, setRestoring] = useState(false)
  const [erased] = useState(() => takeErasedNotice(APP_ID))
  const [demoEnded] = useState(demoEndedByReload)
  return (
    <Shell>
      <div className="auth">
        <div className="auth-card">
          <div className="auth-head">
            <AppIcon />
            <h1>{restoring ? 'Restore from a backup' : mode === 'locked' ? 'Welcome back' : 'Set up your vault'}</h1>
            <p>
              {restoring
                ? 'Choose a BabyTrails backup and enter the passphrase it was made with. It replaces anything already in this browser.'
                : mode === 'locked'
                  ? "Unlock to see your baby's records."
                  : 'Your vault is the locked, encrypted space in this browser where BabyTrails keeps your records. Choose a passphrase to lock it: a few random words are easiest.'}
            </p>
          </div>
          {erased && !restoring && mode === 'welcome' && (
            <Callout tone="accent">
              <p role="status">Everything is deleted from this browser.</p>
            </Callout>
          )}
          {demoEnded && !restoring && (
            <Callout tone="accent">
              <p role="status">
                The demo ended because the page was reloaded.{' '}
                <button
                  className="link-button"
                  onClick={async () => {
                    await startDemo()
                    navigate(childPath(DEMO_CHILD_ID))
                  }}
                >
                  Try the demo again
                </button>
              </p>
            </Callout>
          )}
          <div className="card">
            {restoring && trails ? (
              <RestoreBackup
                db={trails.db}
                vault={trails.vault}
                appId={APP_ID}
                appName="BabyTrails"
                intro={false}
                onRestored={() => {
                  forgetPlace()
                  setRestoring(false)
                  setNotice('restored')
                  void reload()
                }}
              />
            ) : mode === 'locked' ? (
              <Unlock />
            ) : (
              <CreateVault />
            )}
          </div>
          {mode === 'locked' && !restoring && trails && (
            <ForgotPassphrase appId={APP_ID} appName="BabyTrails" db={trails.db} vault={trails.vault} channel={trails.channel} home={APP} onRestore={() => setRestoring(true)} />
          )}
          <div className="auth-links">
            <button className="link-button" onClick={() => setRestoring((r) => !r)}>
              <ArchiveRestore size={14} aria-hidden /> {restoring ? 'Back' : 'Restore from a backup'}
            </button>
            <button
              className="link-button"
              onClick={async () => {
                await startDemo()
                navigate(childPath(DEMO_CHILD_ID))
              }}
            >
              Try the demo instead
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function CreateVault() {
  const { createVault } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [again, setAgain] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { problem } = checkPassphrase(passphrase, 'BabyTrails')
    if (problem) return setError(problem)
    if (passphrase !== again) return setError("The two passphrases don't match.")
    if (!understood) return setError('Please confirm you understand there is no way to reset it.')
    setBusy(true)
    setError('')
    try {
      await createVault(passphrase)
    } catch (err) {
      setError(err instanceof WeakPassphraseError || err instanceof KdfUnavailableError ? err.message : 'The vault could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <TextField
        label="Passphrase"
        type="password"
        autoComplete="new-password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        hint="At least 12 characters. Four or more random words are easy to type and hard to guess."
      />
      <PassphraseStrength passphrase={passphrase} appName="BabyTrails" />
      <TextField label="Passphrase again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      <Checkbox checked={understood} onChange={setUnderstood}>
        <strong>There's no way to reset it.</strong> If I forget it, my records can't be recovered, by anyone, so I'll keep a backup.
      </Checkbox>
      {error && (
        <p className="error form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary block large" disabled={busy}>
        <ShieldCheck size={18} aria-hidden /> {busy ? 'Setting up…' : 'Create the vault'}
      </button>
      <p className="hint form-footnote">BabyTrails keeps records and draws charts; it doesn't give medical advice.</p>
    </form>
  )
}

function Unlock() {
  const { unlock, notice } = useSession()
  // Where the lock or a reload interrupted you (X-05); not after a restore, whose records differ.
  const [place] = useState(savedPlace)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      resumeAfterUnlock(place && notice !== 'restored' ? place : null)
      await unlock(passphrase)
    } catch (err) {
      setError(err instanceof WrongPassphraseError || err instanceof KdfUnavailableError ? err.message : 'The vault could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {notice === 'restored' && (
        <p className="form-error" role="status">
          {RESTORED_MESSAGE}
        </p>
      )}
      {place && notice !== 'restored' && (
        <p className="form-error" role="status">
          You were on {placeName(place)}. Unlock to continue.
        </p>
      )}
      <TextField label="Passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} error={error} autoFocus />
      <button className="button primary block large" disabled={busy || !passphrase}>
        <KeyRound size={18} aria-hidden /> {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}

function Children() {
  const children = useChildren()
  const { notice } = useSession()
  if (children === null) return <Shell narrow>{<div className="skeleton loading-card" />}</Shell>
  // One child (the usual case): go straight to their overview.
  if (children.length === 1) return <Navigate to={childPath(children[0].id)} replace />

  return (
    <Shell narrow>
      <PageHeader
        title={children.length ? 'Your children' : 'Welcome'}
        actions={
          children.length > 0 && (
            <Link className="button primary" to={`${APP}/child/new`}>
              <Plus size={16} aria-hidden /> Add a child
            </Link>
          )
        }
      />
      <BackupNudge />
      {notice === 'created' && (
        <Callout icon={HardDrive} tone="accent">
          <p>Your records live only in this browser. Download a backup now and then, and keep it somewhere else.</p>
        </Callout>
      )}
      {children.length === 0 ? (
        <>
          <EmptyState
            icon={Baby}
            title="Add your baby to start"
            action={
              <Link className="button primary" to={`${APP}/child/new`}>
                <Plus size={16} aria-hidden /> Add a child
              </Link>
            }
          >
            Their name, date of birth and sex, for the WHO charts. You can add more children later.
          </EmptyState>
          <InstallHint />
        </>
      ) : (
        <div className="card padless list">
          {children.map((c) => (
            <Link key={c.id} to={childPath(c.id)} className="list-row">
              <span className="avatar" aria-hidden="true">
                {(c.nickname || c.name).slice(0, 1).toUpperCase()}
              </span>
              <span className="list-row-main">
                <span className="list-row-title">{c.nickname || c.name}</span>
                <span className="list-row-sub">{formatAge(c.dateOfBirth, today())} old</span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </Link>
          ))}
        </div>
      )}
      <Disclaimer />
    </Shell>
  )
}
