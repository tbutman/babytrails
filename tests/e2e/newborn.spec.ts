import { test, expect, addChild, addMeasurement, createVault, tab } from './fixtures'

// Dates relative to today, so the baby is always 20 days old. Made-up values.
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('a newborn: birth weight from the child form, weight change from birth, charts in weeks', async ({ page }) => {
  await page.goto('/app')
  await createVault(page)
  await addChild(page, { name: 'Nova Example', dob: daysAgo(20), sex: 'Girl', birthKg: '3.50' })
  await addMeasurement(page, { date: daysAgo(16), kg: '3.10' })
  await addMeasurement(page, { date: daysAgo(6), kg: '3.45' })

  const weeks = page.getByRole('region', { name: 'The first weeks' })
  await expect(weeks).toContainText('3.50 kg')
  await expect(weeks).toContainText('−11.4% on day 4')
  await expect(weeks).toContainText('not yet')
  await expect(weeks).toContainText('NICE guideline NG75')

  await tab(page, 'Measurements').click()
  await expect(page.locator('.list-row-title', { hasText: '· Birth' })).toBeVisible()
  await expect(page.getByText(/−11\.4% from birth weight/)).toBeVisible()

  await tab(page, 'Charts').click()
  await expect(page.locator('.chart').getByText('2 wk', { exact: true })).toBeVisible()
})
