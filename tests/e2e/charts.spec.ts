// Charts that explain themselves (BABY-10), and what isn't charted (BABY-11).

import { addChild, addMeasurement, createVault, expect, startDemo, tab, test } from './fixtures'

test('the chart says what a percentile is, labels its lines, and can be read as a table', async ({ page }) => {
  await startDemo(page)
  await tab(page, 'Charts').click()
  await expect(page.getByText(/A percentile compares your baby with WHO's reference babies of the same age and sex/)).toBeVisible()
  await expect(page.getByText(/^Latest:/)).toContainText('59th percentile')
  const chart = page.getByRole('img', { name: /Weight for age, WHO percentile bands/ })
  await expect(chart).toHaveAttribute('aria-label', /59th percentile/)
  for (const line of ['3rd', '15th', '50th', '85th', '97th']) await expect(chart.locator('text', { hasText: new RegExp(`^${line}$`) })).toHaveCount(1)
  await page.getByText('Show as a table').click()
  await expect(page.getByRole('columnheader', { name: 'Percentile' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '59th' }).first()).toBeVisible()
})

test('measurements after 5 years are kept, and the app says why they have no percentile', async ({ page }) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2020-01-01', sex: 'Girl' })
  await addMeasurement(page, { date: '2026-09-01', kg: '21' })
  await expect(page.getByText('No percentile: the WHO charts in BabyTrails end at 5 years, so newer measurements are kept but not charted.')).toBeVisible()
})
