import { test, expect, startDemo, createVault, addChild, addMeasurement, tab, PASS } from './fixtures'

test('the built page carries the Content-Security-Policy', async ({ page }) => {
  await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("connect-src 'self' https://api.anthropic.com")
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
})

test('the landing page introduces the app and links to LabTrails', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every check-up')
  await expect(page.getByRole('img', { name: /preview of BabyTrails/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Also from Trails: LabTrails/ })).toHaveAttribute('href', 'https://labtrails.app')
  await page.getByRole('link', { name: 'Set up your vault' }).first().click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: 'Set up your vault' })).toBeVisible()
})

test('old addresses redirect into /app', async ({ page }) => {
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/app(\/settings)?$/)
  await page.goto('/child/x/measure')
  await expect(page).toHaveURL(/\/app/)
})

test('the demo works without a passphrase or key', async ({ page }) => {
  await startDemo(page)
  await expect(page.getByText('A made-up baby with made-up measurements')).toBeVisible()
  await expect(page.getByText(/percentile/).first()).toBeVisible()
  // Gain over time: the latest gain, the same-line reference, and a bar per interval.
  await expect(page.getByRole('heading', { name: 'Gain over time' })).toBeVisible()
  await expect(page.getByText(/Staying on the same percentile line would have meant about \d+ g a week/)).toBeVisible()
  await expect(page.getByRole('img', { name: /Gain per interval, oldest first/ })).toBeVisible()
  await expect(page.getByText("Against WHO's standards for weight gain from 5–6 months, that's about the 50th percentile.")).toBeVisible()
  await tab(page, 'Measurements').click()
  await expect(page.getByText(/weight \+\d+ g a week since/).first()).toBeVisible()
  await tab(page, 'Charts').click()
  await expect(page.getByRole('img', { name: /Weight for age, WHO percentile bands. 9 measurements/ })).toBeVisible()
  await page.getByRole('button', { name: 'Leave demo' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Set up your vault' }).first()).toBeVisible()
})

test('a vault: create, add a child and a measurement, lock, unlock', async ({ page }) => {
  await page.goto('/app')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
  await page.getByLabel('Passphrase again').fill(PASS)
  await page.getByRole('button', { name: 'Create the vault' }).click()
  await expect(page.getByText('Please confirm you understand')).toBeVisible()
  await createVault(page)

  await addChild(page, { name: 'Sam Example', dob: '2026-03-01', sex: 'Boy' })
  await addMeasurement(page, { date: '2026-09-01', kg: '7,25', lengthCm: '66.5' })
  await expect(page.getByText(/percentile/).first()).toBeVisible()
  await tab(page, 'Measurements').click()
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
