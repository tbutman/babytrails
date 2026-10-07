import { Archive, Bot, HardDrive, KeyRound, Palette, Ruler, Timer, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { ApiKeySettings } from '../../core/ai/ApiKeySettings'
import { ExportBackup, RestoreBackup } from '../../core/backup/BackupForms'
import { ChangePassphrase, EraseVault } from '../../core/vault/VaultForms'
import type { Theme } from '../../core/settings/settings'
import { Callout, PageHeader, Segmented, SelectField, type Icon } from '../../core/ui/components'
import { APP } from '../brand'
import { InstallHint } from '../InstallHint'
import { Shell } from '../Layout'
import { useSession } from '../sessionContext'
import { APP_ID } from '../types'

const TWO_WEEKS = 14 * 86_400_000

// Reminds people to back up: browser storage can be cleared, and a backup is the only copy that
// survives that.
export function BackupNudge() {
  const { core, mode, saveCore, vaultCreatedAt } = useSession()
  const [now] = useState(() => Date.now())
  if (mode !== 'unlocked') return null
  // Never backed up: count from when the vault was set up, not from 1970 (BABY-14).
  const last = Date.parse(core.lastBackupAt ?? vaultCreatedAt ?? '') || now
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
  const { core, app, saveCore, saveApp, mode, trails, reload, setNotice } = useSession()
  if (mode !== 'unlocked' || !trails) return <Navigate to={APP} replace />

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
          <ApiKeySettings appName="BabyTrails" apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />
        </SettingsCard>

        <SettingsCard id="backup" icon={HardDrive} title="Backup">
          <ExportBackup
            db={trails.db}
            appId={APP_ID}
            lastBackupAt={core.lastBackupAt}
            onExported={() => saveCore({ ...core, lastBackupAt: new Date().toISOString(), changesSinceBackup: 0 })}
          />
          <StorageStatus />
          <InstallHint />
          <details className="disclosure">
            <summary>Restore from a backup</summary>
            <div className="disclosure-body">
              <RestoreBackup
                db={trails.db}
                vault={trails.vault}
                appId={APP_ID}
                appName="BabyTrails"
                onRestored={() => {
                  setNotice('restored')
                  void reload()
                }}
              />
            </div>
          </details>
        </SettingsCard>

        <SettingsCard icon={KeyRound} title="Passphrase">
          <ChangePassphrase vault={trails.vault} appName="BabyTrails" />
        </SettingsCard>

        <SettingsCard id="erase" icon={Trash2} title="Erase this vault">
          <p className="hint">Deletes everything BabyTrails keeps in this browser, so you can start again. Backups you downloaded aren't affected.</p>
          <EraseVault appId={APP_ID} appName="BabyTrails" db={trails.db} vault={trails.vault} channel={trails.channel} home={APP} />
        </SettingsCard>

        <p className="hint">
          BabyTrails is free and open source. Your records are encrypted on this device, in this browser, and never reach the BabyTrails server.{' '}
          <Link to={`${APP}/about`}>About the data and charts</Link>.
        </p>
      </div>
    </Shell>
  )
}

export function About() {
  return (
    <Shell narrow>
      <PageHeader title="About the data and charts" back={{ to: APP, label: 'Back' }} />
      <div className="card">
        <p>
          The charts and percentiles use the <strong>WHO Child Growth Standards</strong> (birth to 5 years). © World Health Organization. Used
          with acknowledgment in a free, non-commercial app, as WHO's terms of use allow. WHO doesn't endorse BabyTrails. Source:{' '}
          <a href="https://www.who.int/tools/child-growth-standards">who.int/tools/child-growth-standards</a>.
        </p>
        <p>
          In the United States, the CDC recommends the WHO charts from birth to 2 years. In Portugal, the national child health program
          uses the WHO curves (weight, length or height and BMI to 5 years; head circumference to 2 years). CDC charts for children over 2
          aren't in BabyTrails yet.
        </p>
        <p>
          Percentiles are worked out on this device with WHO's own formulas (the LMS method). A percentile describes where a measurement sits compared with WHO's
          reference children; it isn't a diagnosis. Your pediatrician looks at much more than one number.
        </p>
        <p>BabyTrails is open source under the MIT license. The WHO data is not covered by that license.</p>
      </div>
    </Shell>
  )
}
