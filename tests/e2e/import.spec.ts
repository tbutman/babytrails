import { test, expect, startDemo, tab } from './fixtures'

// A tiny PNG with made-up bytes, standing in for an ultrasound photo.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

test('demo: duplicates are caught, ultrasound images are kept unread, and saved measurements are not saved twice', async ({ page }) => {
  await startDemo(page)
  await tab(page, 'Documents').click()
  await page.getByRole('link', { name: 'Add documents' }).first().click()

  // The sample is the same file as the demo's stored document, so it's set aside.
  await page.getByRole('button', { name: 'Add the sample document' }).click()
  const queue = page.locator('.import-queue')
  await expect(queue.getByText('Already imported')).toBeVisible()
  // An ultrasound image is recognised by its name and kept without reading.
  await page.getByLabel('Add PDFs, photos or zip files').setInputFiles({ name: 'ecografia-20-semanas.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByLabel('What is ecografia-20-semanas.png?')).toHaveValue('ultrasound')
  await expect(queue.getByText('Keep without reading').first()).toBeVisible()

  await queue.getByRole('button', { name: 'Import anyway' }).click()
  await page.getByRole('button', { name: 'Read 1 document' }).click()
  await expect(page.getByRole('heading', { name: 'Check document 1 of 1' })).toBeVisible()
  // The page repeats every saved check-up: those are left out, and only the new visit is checked.
  await expect(page.getByText('8 rows already saved, left out')).toBeVisible()
  await expect(page.getByText(/This looks like/)).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Date order' })).toHaveCount(0)
  for (const tick of await page.getByLabel('This matches the document').all()) await tick.check()
  await page.getByRole('button', { name: 'Save 1 row' }).click()
  await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
  await expect(page.getByText(/1 saved · 1 kept without reading/)).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('link', { name: /ecografia-20-semanas\.png.*Ultrasound image/ })).toBeVisible()

  // The demo's own copy of the report is still listed as not read; reading it finds everything saved.
  await page.getByRole('link', { name: 'Read', exact: true }).click()
  await page.getByRole('button', { name: 'Read 1 document' }).click()
  await expect(page.getByText('Everything in this document is already saved.')).toBeVisible()
  await expect(page.getByText('9 rows already saved, left out')).toBeVisible()
  await page.getByRole('button', { name: 'Mark as read and continue' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: /Not read yet/ })).toHaveCount(0)
  await tab(page, 'Measurements').click()
  await expect(page.getByText('10 recorded')).toBeVisible()
})
