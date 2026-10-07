// The vault's own flows: changing the passphrase, restoring a backup, erasing everything, and tabs
// that lock together (CORE-01, CORE-02, CORE-03, CORE-08, CORE-09).

import { addChild, createVault, expect, PASS, test } from './fixtures'

const NEW_PASS = 'quartz meadow tulip anchor'

test('a weak passphrase is refused, with a hint while typing', async ({ page }) => {
  await page.goto('/app')
  await page.getByLabel('Passphrase', { exact: true }).fill('aaaaaaaaaaaa')
  await expect(page.getByText(/Weak: try four random words/)).toBeVisible()
  await page.getByLabel('Passphrase again').fill('aaaaaaaaaaaa')
  await page.getByLabel(/no way to reset it/).check()
  await page.getByRole('button', { name: 'Create the vault' }).click()
  await expect(page.getByRole('alert')).toContainText('Use at least 4 different characters.')
  await page.getByLabel('Passphrase', { exact: true }).fill(NEW_PASS)
  await expect(page.getByText('Strong', { exact: true })).toBeVisible()
})

test('changing the passphrase asks for the new one twice', async ({ page }) => {
  await createVault(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('Current passphrase').fill(PASS)
  await page.getByLabel('New passphrase', { exact: true }).fill(NEW_PASS)
  await page.getByLabel('New passphrase again').fill('quartz meadow tulip anchors')
  await page.getByRole('button', { name: 'Change passphrase' }).click()
  await expect(page.getByRole('alert')).toContainText("The two new passphrases don't match.")
  await page.getByLabel('New passphrase again').fill(NEW_PASS)
  await page.getByRole('button', { name: 'Change passphrase' }).click()
  await expect(page.getByRole('status')).toContainText('Passphrase changed. Older backups still open with the old one.')

  await page.getByRole('button', { name: 'Lock' }).click()
  await page.getByLabel('Passphrase').fill(NEW_PASS)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
})

test('a restore checks the passphrase before anything changes, then asks to unlock', async ({ page }, info) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await page.getByRole('link', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download a backup' }).click()
  const file = info.outputPath('backup.json')
  await (await download).saveAs(file)
  await expect(page.getByText(/The backup includes your settings and AI key, still encrypted/)).toBeVisible()

  // A wrong passphrase: the error stays, and the vault stays open.
  await page.getByText('Restore from a backup').click()
  await page.getByLabel('Choose a backup file').setInputFiles(file)
  await page.getByLabel("The backup's passphrase").fill('maple orbit velvet kayak')
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('alert')).toContainText("That passphrase doesn't open this backup.")
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // The right one: replaced, locked, and the Unlock form says so.
  page.once('dialog', (d) => void d.accept())
  await page.getByLabel("The backup's passphrase").fill(PASS)
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('status')).toContainText("Restored. Enter the backup's passphrase to open it.")
  await page.getByLabel('Passphrase').fill(PASS)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Jane Doe' })).toBeVisible()
})

test('a forgotten passphrase: erase this vault by typing the app name', async ({ page }) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await page.getByRole('button', { name: 'Lock' }).click()
  await page.getByRole('button', { name: 'Forgot your passphrase?' }).click()
  await expect(page.getByText('Nobody can reset it. You can restore a backup, or erase this vault and start again.')).toBeVisible()
  await page.getByRole('button', { name: 'Erase this vault' }).click()
  await expect(page.getByText(/including your AI key\. Backups you downloaded aren't affected\. It can't be undone\. Type BabyTrails to confirm\./)).toBeVisible()
  const erase = page.getByRole('button', { name: 'Erase everything' })
  await expect(erase).toBeDisabled()
  await page.getByLabel('Type BabyTrails to confirm').fill('babytrails')
  await erase.click()
  await expect(page.getByText('Everything is deleted from this browser.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set up your vault' })).toBeVisible()
  // The app opens a new, empty database after the reload: no vault and no records in it.
  const left = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('babytrails-vault')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const count = (store: string) =>
      new Promise<number>((resolve) => {
        const r = db.transaction(store).objectStore(store).count()
        r.onsuccess = () => resolve(r.result)
      })
    return { meta: await count('meta'), records: await count('records') }
  })
  expect(left).toEqual({ meta: 0, records: 0 })
})

test('locking one tab locks the others, and changes show in every tab', async ({ page, context }) => {
  await createVault(page)
  const other = await context.newPage()
  await other.goto('/app')
  await other.getByLabel('Passphrase').fill(PASS)
  await other.getByRole('button', { name: 'Unlock' }).click()
  await expect(other.getByRole('heading', { name: 'Welcome' })).toBeVisible()

  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await expect(other.getByRole('heading', { name: 'Jane Doe' })).toBeVisible()

  await page.getByRole('button', { name: 'Lock' }).click()
  await expect(other.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(other.getByText('Jane Doe')).toHaveCount(0)
})
