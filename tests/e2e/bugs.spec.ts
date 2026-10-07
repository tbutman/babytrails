// The review's bug fixes in the app (BABY-04, BABY-05, BABY-13, BABY-20).

import { addChild, addMeasurement, createVault, expect, tab, test } from './fixtures'

test('a weight typed with its unit is saved, and anything else is questioned', async ({ page }) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await addMeasurement(page, { date: '2026-09-01', kg: '6.1 kg', lengthCm: '61 cm' })
  await tab(page, 'Measurements').click()
  await expect(page.getByText('6.10 kg').first()).toBeVisible()

  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await page.getByLabel('Date', { exact: true }).fill('2026-09-08')
  await page.getByLabel('Weight (kg)').fill('6.3 pounds')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText("That doesn't look like a number.")).toBeVisible()
})

test('a second measurement on the same day is asked about once', async ({ page }) => {
  await createVault(page)
  await addChild(page, { name: 'Jane Doe', dob: '2026-03-01', sex: 'Girl' })
  await addMeasurement(page, { date: '2026-09-01', kg: '6.1' })
  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await page.getByLabel('Date', { exact: true }).fill('2026-09-01')
  await page.getByLabel('Weight (kg)').fill('6.2')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toContainText('You already have a measurement on Sep 1, 2026. Add another?')
  await page.getByRole('button', { name: 'Add another' }).click()
  await tab(page, 'Measurements').click()
  await expect(page.getByText('2 recorded')).toBeVisible()
})

test('"Add a child" while locked goes to the start instead of crashing; unknown app addresses too', async ({ page }) => {
  await page.goto('/app/child/new')
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: 'Set up your vault' })).toBeVisible()
  await page.goto('/app/nothing-here')
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/child/new')
  await expect(page.getByRole('heading', { name: 'Set up your vault' })).toBeVisible()
})
