import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

test('the report exports as a PNG and a PDF, made in the browser', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await page.getByRole('link', { name: 'Share a report' }).click()
  await expect(page.getByRole('img', { name: 'Preview of the report' })).toBeVisible()

  // "No name" keeps the name off the report.
  await page.getByRole('button', { name: 'No name' }).click()
  const src = await page.getByRole('img', { name: 'Preview of the report' }).getAttribute('src')
  expect(decodeURIComponent(src!)).not.toContain('Robin')
  expect(decodeURIComponent(src!)).toContain('Growth report')

  const png = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save image' }).click()
  const pngFile = readFileSync((await (await png).path())!)
  expect([...pngFile.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const pdf = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PDF' }).click()
  const pdfFile = readFileSync((await (await pdf).path())!)
  expect(pdfFile.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdfFile.toString('latin1')).toContain('/Filter /DCTDecode')
})
