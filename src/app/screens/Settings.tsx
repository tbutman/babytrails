import { Archive, Bot, HardDrive, KeyRound, Palette, Ruler, Timer } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '../../core'
import { ApiKeySettings } from '../../core/ai/ApiKeySettings'
import type { Theme } from '../../core/settings/settings'
import { Callout, PageHeader, Segmented, SelectField, TextField, type Icon } from '../../core/ui/components'
import { APP } from '../brand'
import { InstallHint } from '../InstallHint'
import { Shell } from '../Layout'
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
    <Callout icon={Archive} tone="warning">
      <p>
        <strong>Time for a backup.</strong> If this browser's data is cleared, a backup is the only way to get your records back.
      </p>
      <div className="row">
        <Link to={`${APP}/settings#backup`} className="button small primary">
          Back up now
        </Link>
        <button className="button small ghost" onClick={() => void saveCore({ ...core, backupNudgeDismissedAt: new Date().toISOString() })}>
          Later
        </button>
      </div>
    </Callout>
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

function SettingsCard({ id, icon: I, title, children }: { id?: string; icon: Icon; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card">
      <div className="card-header">
        <h3>
          <I size={18} aria-hidden /> {title}
        </h3>
      </div>
      {children}
    </section>
  )
}

export function Settings() {
  const { core, app, saveCore, saveApp, mode } = useSession()
  if (mode !== 'unlocked') return <Navigate to={APP} replace />

  return (
    <Shell narrow>
      <PageHeader title="Settings" back={{ to: APP, label: 'Back' }} />
      <div className="stack">
        <SettingsCard icon={Ruler} title="Units">
          <Segmented
            legend="Units"
            name="units"
            value={app.units}
            onChange={(units) => void saveApp({ ...app, units })}
            options={[
              { value: 'metric', label: 'Metric (kg, cm)' },
              { value: 'imperial', label: 'Imperial (lb, in)' },
            ]}
          />
        </SettingsCard>

        <SettingsCard icon={Palette} title="Appearance">
          <Segmented
            legend="Theme"
            name="theme"
            value={core.theme}
            onChange={(theme: Theme) => void saveCore({ ...core, theme })}
            options={[
              { value: 'system', label: 'Match device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </SettingsCard>

        <SettingsCard icon={Timer} title="Lock">
          <SelectField label="Lock after this many minutes without use" value={core.autoLockMinutes} onChange={(e) => void saveCore({ ...core, autoLockMinutes: Number(e.target.value) })}>
            {[1, 2, 5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m} minute{m === 1 ? '' : 's'}
              </option>
            ))}
          </SelectField>
        </SettingsCard>

        <SettingsCard id="ai" icon={Bot} title="AI (optional)">
          <ApiKeySettings apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />
        </SettingsCard>

        <SettingsCard id="backup" icon={HardDrive} title="Backup">
          <ExportBackup />
          <StorageStatus />
          <InstallHint />
          <details className="disclosure">
            <summary>Restore from a backup</summary>
            <div className="disclosure-body">
              <RestoreBackup />
            </div>
          </details>
        </SettingsCard>

        <SettingsCard icon={KeyRound} title="Passphrase">
          <ChangePassphrase />
        </SettingsCard>

        <p className="hint">
          BabyTrails is free and open source. Your records are encrypted on this device and never sent to BabyTrails' server.{' '}
          <Link to={`${APP}/about`}>About the data and charts</Link>.
        </p>
      </div>
    </Shell>
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
    <form onSubmit={submit} noValidate>
      <TextField label="Current passphrase" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <TextField label="New passphrase" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={error} />
      <button className="button" type="submit" disabled={!current || !next}>
        Change passphrase
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  )
}

export function About() {
  return (
    <Shell narrow>
      <PageHeader title="About the data and charts" back={{ to: APP, label: 'Back' }} />
      <div className="card">
        <p>
          The charts and percentiles use the <strong>WHO Child Growth Standards</strong> (birth to 5 years), © World Health Organization, used
          unmodified for non-commercial purposes. WHO doesn't endorse this app. Source:{' '}
          <a href="https://www.who.int/tools/child-growth-standards">who.int/tools/child-growth-standards</a>.
        </p>
        <p>
          In the United States, the CDC recommends the WHO charts from birth to 2 years. In Portugal, the national child health programme
          uses the WHO curves (weight, length or height and BMI to 5 years; head circumference to 2 years). CDC charts for children over 2
          aren't in BabyTrails yet.
        </p>
        <p>
          Percentiles are computed with WHO's LMS method on this device. A percentile describes where a measurement sits compared with WHO's
          reference children; it isn't a diagnosis. Your paediatrician looks at much more than one number.
        </p>
        <p>BabyTrails is open source under the MIT licence. The WHO data is not covered by that licence.</p>
      </div>
    </Shell>
  )
}
