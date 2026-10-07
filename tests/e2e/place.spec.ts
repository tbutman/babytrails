// Lock or reload doesn't lose your place (X-05).

import { addChild, createVault, expect, PASS, startDemo, test } from './fixtures'

test('a reload mid-form asks first, and unlocking goes back to the form', async ({ page }) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await page.getByLabel('Weight (kg)').fill('6.1')
  let asked = false
  page.once('dialog', (d) => {
    asked = d.type() === 'beforeunload'
    void d.accept()
  })
  await page.reload()
  expect(asked).toBe(true)
  await expect(page.getByText('You were on Add a measurement. Unlock to continue.')).toBeVisible()
  await page.getByLabel('Passphrase').fill(PASS)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Add a measurement' })).toBeVisible()
})

test('locking from a screen comes back to it', async ({ page }) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Charts', exact: true }).click()
  await page.getByRole('button', { name: 'Lock' }).click()
  await expect(page.getByText('You were on Growth charts. Unlock to continue.')).toBeVisible()
  await page.getByLabel('Passphrase').fill(PASS)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Growth charts' })).toBeVisible()
})

test('a reload during the demo says it ended', async ({ page }) => {
  await startDemo(page)
  await page.reload()
  await expect(page.getByText('The demo ended because the page was reloaded.')).toBeVisible()
  await page.getByRole('button', { name: 'Try the demo again' }).click()
  await expect(page.getByRole('heading', { name: 'Robin' })).toBeVisible()
})
