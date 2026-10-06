import { test, expect } from './fixtures'

const PASS = 'maple orbit velvet canoe'

test('the built page carries the Content-Security-Policy', async ({ page }) => {
  await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("connect-src 'self' https://api.anthropic.com")
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
})

test('the demo works without a passphrase or key', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await expect(page.getByRole('status')).toContainText('made-up baby')
  await expect(page.getByRole('heading', { name: 'Robin' })).toBeVisible()
  await expect(page.getByText(/percentile/).first()).toBeVisible()
  await expect(page.getByRole('img', { name: /Weight for age, WHO percentile bands. 9 measurements/ })).toBeVisible()
  await page.getByRole('button', { name: 'Leave demo' }).click()
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
})

test('a vault: create, add a child and a measurement, lock, unlock', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
  await page.getByLabel('Type it again').fill(PASS)
  await page.getByRole('button', { name: 'Create my vault' }).click()
  await expect(page.getByText('Please confirm you understand')).toBeVisible()
  await page.getByLabel(/can't be reset/).check()
  await page.getByRole('button', { name: 'Create my vault' }).click()

  await page.getByRole('link', { name: 'Add a child' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Sam Example')
  await page.getByLabel('Date of birth').fill('2026-03-01')
  await page.getByRole('button', { name: 'Boy' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Sam Example' })).toBeVisible()

  await page.getByRole('link', { name: 'Add a measurement' }).click()
  await page.getByLabel('Date').fill('2026-09-01')
  await page.getByLabel('Weight (kg)').fill('7,25')
  await page.getByLabel(/Length, lying down/).fill('66.5')
  await expect(page.getByText(/percentile for age/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('7.25 kg').first()).toBeVisible()

  // Locking hides everything; a wrong passphrase doesn't open it.
  await page.getByRole('button', { name: 'Lock' }).click()
  await expect(page.getByText('Sam Example')).toHaveCount(0)
  await page.getByLabel('Passphrase').fill('maple orbit velvet kayak')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText("doesn't open this vault")

  // After a reload the vault is locked; the right passphrase brings everything back.
  await page.reload()
  await page.getByLabel('Passphrase').fill(PASS)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Sam Example' })).toBeVisible()
  await expect(page.getByText('7.25 kg').first()).toBeVisible()

  // Nothing readable is stored in IndexedDB.
  const raw = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('babytrails-vault')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const rows = await new Promise<unknown[]>((resolve) => {
      const r = db.transaction('records').objectStore('records').getAll()
      r.onsuccess = () => resolve(r.result)
    })
    return JSON.stringify(rows, (_k, v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : v))
  })
  expect(raw).not.toContain('Sam Example')
  expect(raw).not.toContain('2026-03-01')
})
