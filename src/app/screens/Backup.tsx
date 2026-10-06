import { useState, type FormEvent } from 'react'
import { WrongPassphraseError } from '../../core'
import { backupFileName, exportBackup, readBackup, restoreBackup, BackupError } from '../../core/backup/backup'
import { Field } from '../components'
import { useSession } from '../sessionContext'
import { APP_ID } from '../types'

export function ExportBackup() {
  const { trails, core, saveCore, mode } = useSession()
  const [busy, setBusy] = useState(false)
  if (mode !== 'unlocked' || !trails) return null

  async function download() {
    if (!trails) return
    setBusy(true)
    try {
      const blob = await exportBackup(trails.db, APP_ID)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName(APP_ID)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await saveCore({ ...core, lastBackupAt: new Date().toISOString(), changesSinceBackup: 0 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p>
        A backup is one file with everything, including documents, still encrypted. Your passphrase opens
        it. Keep it somewhere other than this device, such as your cloud storage or email.
      </p>
      <p className="hint">
        {core.lastBackupAt ? `Last backup: ${new Date(core.lastBackupAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}.` : 'No backup yet.'}
      </p>
      <button className="button primary" onClick={() => void download()} disabled={busy}>
        {busy ? 'Preparing…' : 'Download a backup'}
      </button>
    </div>
  )
}

export function RestoreBackup() {
  const { trails, reload, lock } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!trails || !file) return
    setBusy(true)
    setError('')
    try {
      const backup = await readBackup(file, APP_ID)
      if ((await trails.vault.exists()) && !window.confirm('This replaces everything on this device with the backup. Continue?')) return
      lock()
      await restoreBackup(trails.db, backup, passphrase)
      setDone(true)
      await reload()
    } catch (err) {
      setError(err instanceof WrongPassphraseError || err instanceof BackupError ? err.message : 'The backup could not be restored.')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p role="status">Restored. Unlock with the backup's passphrase.</p>

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <p>Choose a BabyTrails backup file and enter the passphrase it was made with.</p>
      <Field label="Backup file" htmlFor="backup-file">
        <input id="backup-file" type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Passphrase" htmlFor="backup-pass" error={error}>
        <input id="backup-pass" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      </Field>
      <button className="button primary" type="submit" disabled={busy || !file || !passphrase}>
        {busy ? 'Checking…' : 'Restore'}
      </button>
    </form>
  )
}
