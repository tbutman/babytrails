import { test, expect, addChild, createVault, tab } from './fixtures'

// Made-up values.
test('doubtful measurements: where measured, second looks, and leaving one out', async ({ page }) => {
  await page.goto('/app')
  await createVault(page)
  await addChild(page, { name: 'Remy Example', dob: '2026-04-01', sex: 'Boy' })

  // A home measurement far off the chart: a warning, but it saves, and the next form remembers "Home".
  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await page.getByLabel('Date', { exact: true }).fill('2026-06-10')
  await page.getByLabel(/Length, lying down/).fill('68')
  await expect(page.getByText(/far above the chart for this age/)).toBeVisible()
  await page.getByLabel('Home', { exact: true }).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Remy Example' })).toBeVisible()

  // A very unlikely value needs a second tap.
  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await expect(page.getByLabel('Home', { exact: true })).toBeChecked()
  await page.getByLabel('Clinic', { exact: true }).check()
  await page.getByLabel('Date', { exact: true }).fill('2026-06-15')
  await page.getByLabel('Weight (kg)').fill('25')
  await expect(page.getByText(/very unlikely for this age/)).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toContainText('very unlikely')
  await page.getByRole('button', { name: 'Save anyway' }).click()
  await expect(page.getByRole('heading', { name: 'Remy Example' })).toBeVisible()

  // Leave it out: it stays in the list, marked, and stops counting on the charts.
  await tab(page, 'Measurements').click()
  await expect(page.getByText('at home')).toBeVisible()
  await page.getByRole('link', { name: /15 Jun 2026/ }).click()
  await page.getByLabel(/Leave this out of charts/).check()
  await page.getByLabel('Why (optional)').fill('typing slip')
  await page.getByRole('button', { name: 'Save' }).click()
  await tab(page, 'Measurements').click()
  await expect(page.getByText('Left out')).toBeVisible()
  await tab(page, 'Charts').click()
  await expect(page.getByRole('img', { name: /Weight for age, WHO percentile bands. 0 measurements/ })).toBeVisible()
  await page.getByLabel('Length', { exact: true }).check()
  const length = page.locator('.chart svg[role="img"]')
  await expect(length).toHaveAttribute('aria-label', /1 measurement; latest 68\.0 cm .*at home/)
})
