import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '../../core'
import type { Theme } from '../../core/settings/settings'
import { ApiKeySettings } from '../../core/ai/ApiKeySettings'
import { Field, Page } from '../components'
import { InstallHint } from '../InstallHint'
import { useSession } from '../sessionContext'
import { ExportBackup, RestoreBackup } from './Backup'

const TWO_WEEKS = 14 * 86_400_000

// Reminds people to back up: browser storage can be cleared, and a backup is the only copy that
// survives that.
export function BackupNudge() {
  const { core, mode, saveCore } = useSession()
  const [now] = useState(() => Date.now())
  if (mode !== 'unlocked') return null
  const last = core.lastBackupAt ? Date.parse(core.lastBackupAt) : 0
  const dismissed = core.backupNudgeDismissedAt ? Date.parse(core.backupNudgeDismissedAt) : 0
  const due = core.changesSinceBackup >= 5 || (core.changesSinceBackup > 0 && now - last > TWO_WEEKS)
  if (!due || now - dismissed < 86_400_000) return null
  return (
    <div className="callout" role="status">
      <p>
        <strong>Time for a backup.</strong> {core.changesSinceBackup} change{core.changesSinceBackup === 1 ? '' : 's'} since your
        last one. If this browser's data is cleared, a backup is the only way to get your records back.
      </p>
      <div className="row">
        <Link to="/settings#backup" className="button small primary">
          Back up now
        </Link>
        <button className="button small ghost" onClick={() => void saveCore({ ...core, backupNudgeDismissedAt: new Date().toISOString() })}>
          Later
        </button>
      </div>
    </div>
  )
}

function StorageStatus() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])
  if (persisted === null) return null
  return (
    <p className="hint">
      {persisted
        ? 'This browser has agreed to keep your data unless you clear it yourself.'
        : "This browser hasn't promised to keep your data. Adding BabyTrails to your home screen helps, and backups are essential."}
    </p>
  )
}

export function Settings() {
  const { core, app, saveCore, saveApp } = useSession()

  return (
    <Page title="Settings" back="/">
      <h2>Units</h2>
      <div className="segmented" role="group" aria-label="Units">
        <button type="button" aria-pressed={app.units === 'metric'} onClick={() => void saveApp({ ...app, units: 'metric' })}>
          Metric (kg, cm)
        </button>
        <button type="button" aria-pressed={app.units === 'imperial'} onClick={() => void saveApp({ ...app, units: 'imperial' })}>
          Imperial (lb, in)
        </button>
      </div>

      <h2>Appearance</h2>
      <div className="segmented" role="group" aria-label="Theme">
        {(['system', 'light', 'dark'] as Theme[]).map((t) => (
          <button key={t} type="button" aria-pressed={core.theme === t} onClick={() => void saveCore({ ...core, theme: t })}>
            {t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>

      <h2>Lock</h2>
      <Field label="Lock after this many minutes without use" htmlFor="autolock">
        <select id="autolock" value={core.autoLockMinutes} onChange={(e) => void saveCore({ ...core, autoLockMinutes: Number(e.target.value) })}>
          {[1, 2, 5, 10, 15, 30].map((m) => (
            <option key={m} value={m}>
              {m} minute{m === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </Field>

      <h2 id="ai">AI (optional)</h2>
      <ApiKeySettings apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />

      <h2 id="backup">Backup</h2>
      <ExportBackup />
      <StorageStatus />
      <InstallHint />
      <details>
        <summary>Restore from a backup</summary>
        <RestoreBackup />
      </details>

      <h2>Passphrase</h2>
      <ChangePassphrase />

      <h2>About</h2>
      <p>
        BabyTrails is free and open source. Your records are encrypted on this device and never sent to
        BabyTrails' server. <Link to="/about">About the data and charts</Link>.
      </p>
    </Page>
  )
}

function ChangePassphrase() {
  const { trails } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (next.length < MIN_PASSPHRASE_LENGTH) return setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`)
    try {
      await trails?.vault.changePassphrase(current, next)
      setCurrent('')
      setNext('')
      setMessage('Passphrase changed. Older backups still need the old passphrase.')
    } catch (err) {
      setError(err instanceof WrongPassphraseError ? "Your current passphrase isn't right." : 'Something went wrong.')
    }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <Field label="Current passphrase" htmlFor="cur-pass">
        <input id="cur-pass" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New passphrase" htmlFor="new-pass" error={error}>
        <input id="new-pass" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <button className="button" type="submit" disabled={!current || !next}>
        Change passphrase
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  )
}

export function About() {
  return (
    <Page title="About the data and charts" back="/">
      <p>
        The charts and percentiles use the <strong>WHO Child Growth Standards</strong> (birth to 5 years),
        © World Health Organization, used unmodified for non-commercial purposes. WHO doesn't endorse
        this app. Source: <a href="https://www.who.int/tools/child-growth-standards">who.int/tools/child-growth-standards</a>.
      </p>
      <p>
        In the United States, the CDC recommends the WHO charts from birth to 2 years. In Portugal, the
        national child health programme uses the WHO curves (weight, length or height and BMI to 5
        years; head circumference to 2 years). CDC charts for children over 2 aren't in BabyTrails yet.
      </p>
      <p>
        Percentiles are computed with WHO's LMS method on this device. A percentile describes where a
        measurement sits compared with WHO's reference children; it isn't a diagnosis. Your paediatrician
        looks at much more than one number.
      </p>
      <p>
        BabyTrails is open source under the MIT licence. The WHO data is not covered by that licence.
      </p>
    </Page>
  )
}
