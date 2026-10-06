import { useState, type FormEvent } from 'react'
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '../../core'
import { Disclaimer, Field, Wordmark } from '../components'
import { useSession } from '../sessionContext'
import { RestoreBackup } from './Backup'

export function Welcome() {
  const { startDemo } = useSession()
  const [step, setStep] = useState<'intro' | 'create' | 'restore'>('intro')

  if (step === 'create') return <CreateVault onCancel={() => setStep('intro')} />
  if (step === 'restore') {
    return (
      <main className="page narrow">
        <button className="back-link link-button" onClick={() => setStep('intro')}>
          ← Back
        </button>
        <h1>Restore from a backup</h1>
        <RestoreBackup />
      </main>
    )
  }

  return (
    <main className="page narrow welcome">
      <Wordmark size="lg" />
      <p className="lead">Your baby's growth records, private and in one place.</p>
      <ul className="promises">
        <li>
          <strong>Stays on this device.</strong> Everything you enter is encrypted in this browser. There's
          no account and no server database.
        </li>
        <li>
          <strong>WHO growth charts.</strong> See measurements against the WHO Child Growth Standards.
        </li>
        <li>
          <strong>AI is optional.</strong> If you choose an AI feature, your browser sends that request
          straight to the AI provider, with your own key.
        </li>
      </ul>
      <div className="stack">
        <button className="button primary" onClick={() => setStep('create')}>
          Get started
        </button>
        <button className="button" onClick={() => void startDemo()}>
          Try the demo
        </button>
        <button className="button ghost" onClick={() => setStep('restore')}>
          Restore from a backup
        </button>
      </div>
      <Disclaimer />
    </main>
  )
}

function CreateVault({ onCancel }: { onCancel: () => void }) {
  const { createVault } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) next.passphrase = `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`
    else if (confirm !== passphrase) next.confirm = "The two don't match."
    if (!understood) next.understood = 'Please confirm you understand there is no reset.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await createVault(passphrase)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page narrow">
      <button className="back-link link-button" onClick={onCancel}>
        ← Back
      </button>
      <h1>Choose a passphrase</h1>
      <p>
        Your passphrase encrypts everything on this device. Four or more random words are strong and
        easy to type, for example <em>maple orbit velvet canoe</em> (don't use that one).
      </p>
      <div className="callout warning">
        <strong>There's no way to reset it.</strong> If you forget your passphrase, your records can't be
        recovered, by anyone. Keep a backup, and write the passphrase down somewhere safe.
      </div>
      <form onSubmit={submit} noValidate className="stack">
        <Field label="Passphrase" htmlFor="passphrase" error={errors.passphrase} hint={`At least ${MIN_PASSPHRASE_LENGTH} characters.`}>
          <input id="passphrase" type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        </Field>
        <Field label="Type it again" htmlFor="confirm" error={errors.confirm}>
          <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className={`checkbox${errors.understood ? ' has-error' : ''}`}>
          <input id="understood" type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <label htmlFor="understood">I understand that a forgotten passphrase can't be reset.</label>
          {errors.understood && (
            <p className="error" role="alert">
              {errors.understood}
            </p>
          )}
        </div>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Setting up…' : 'Create my vault'}
        </button>
      </form>
      <Disclaimer compact />
    </main>
  )
}

export function Unlock() {
  const { unlock, startDemo } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlock(passphrase)
    } catch (err) {
      setError(err instanceof WrongPassphraseError ? err.message : 'Something went wrong while unlocking.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page narrow welcome">
      <Wordmark size="lg" />
      <h1 className="visually-hidden">Unlock</h1>
      <form onSubmit={submit} className="stack">
        <Field label="Passphrase" htmlFor="unlock" error={error}>
          <input id="unlock" type="password" autoComplete="current-password" autoFocus value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        </Field>
        <button className="button primary" type="submit" disabled={busy || !passphrase}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
      <button className="button ghost" onClick={() => void startDemo()}>
        Try the demo instead
      </button>
    </main>
  )
}
