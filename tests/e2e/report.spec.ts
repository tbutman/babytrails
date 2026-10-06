import { readFileSync } from 'node:fs'
import { test, expect, startDemo, tab } from './fixtures'

const pngSize = (file: Buffer) => ({ w: file.readUInt32BE(16), h: file.readUInt32BE(20) })
const previewSvg = async (page: import('@playwright/test').Page) =>
  decodeURIComponent((await page.getByRole('img', { name: 'Preview of the report' }).getAttribute('src'))!)

test('the report card exports as a phone image and an A4 PDF, and the simple report still works', async ({ page }) => {
  await startDemo(page)
  await tab(page, 'Share').click()
  await expect(page.getByRole('img', { name: 'Preview of the report' })).toBeVisible()

  // The report card is the default: charts, gain over time, highlights and history.
  await expect.poll(() => previewSvg(page)).toContain('Gain over time')
  const card = await previewSvg(page)
  for (const text of ['Highlights', 'History', 'Weight for length', 'percentile', 'A record, not medical advice']) expect(card).toContain(text)

  // "No name" keeps the name off it; leaving out head circumference removes its chart and column.
  await page.getByLabel('No name').check()
  await expect.poll(() => previewSvg(page)).not.toContain('Robin')
  expect(await previewSvg(page)).toContain('Growth report')
  await page.getByLabel('Include head circumference').uncheck()
  await expect.poll(() => previewSvg(page)).not.toContain('Head circumference for age')

  const png = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save image' }).click()
  const pngFile = readFileSync((await (await png).path())!)
  expect([...pngFile.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(pngSize(pngFile)).toEqual({ w: 1080, h: 1920 })

  const pdf = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PDF' }).click()
  const pdfFile = readFileSync((await (await pdf).path())!)
  expect(pdfFile.subarray(0, 5).toString()).toBe('%PDF-')
  // The A4 layout, drawn at 1.5×.
  expect(pdfFile.toString('latin1')).toMatch(/\/Width 1860 \/Height 2631 .*\/Filter \/DCTDecode/)

  // The simple one-page report.
  await page.getByLabel('Simple').check()
  await expect.poll(() => previewSvg(page)).not.toContain('Gain over time')
  const simple = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save image' }).click()
  expect(pngSize(readFileSync((await (await simple).path())!))).toEqual({ w: 1080, h: 1350 })
})
