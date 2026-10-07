// Takes the README and case-study screenshots, and the landing page's showcase images, from the demo
// (made-up data only), against a running build: npm run build && npx vite preview --port 4190, then
//   node scripts/screenshots.mjs [http://localhost:4190]

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:4190'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs/screenshots')
const landing = join(root, 'public/landing')
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })

async function demo(page) {
  await page.goto(base)
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await page.getByRole('heading', { name: 'Robin' }).waitFor()
  await page.waitForTimeout(600)
}
// For close-ups of one part of a screen: hide the sticky app bar and fixed tab bar, which would
// otherwise sit over the part being captured. (Through the DOM: the app's CSP blocks injected styles.)
const closeUp = async (locator, path) => {
  const bars = (display) => locator.page().evaluate((d) => document.querySelectorAll('.app-bar, .tab-bar').forEach((el) => (el.style.display = d)), display)
  await bars('none')
  await locator.screenshot({ path })
  await bars('')
}
const tab = (page, name) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true })
// From Documents: read the demo's sample growth report, which is listed under "Not read yet".
async function readSample(page) {
  await page.getByRole('link', { name: 'Read', exact: true }).click()
  await page.getByRole('button', { name: 'Read 1 document' }).click()
  await page.getByRole('heading', { name: 'Check document 1 of 1' }).waitFor()
  await page.getByLabel('This matches the document').first().check()
}

// Phone screenshots (README, case study).
const phone = await browser.newPage({ ...devices['iPhone 13'], colorScheme: 'light' })
const shot = (name) => phone.screenshot({ path: join(out, `${name}.png`) })
await phone.goto(base)
await phone.waitForTimeout(800)
await shot('welcome')
await demo(phone)
await shot('child')
await tab(phone, 'Charts').click()
await phone.locator('.chart').waitFor()
// The latest percentile and the chart, below the picker and the explainer.
await phone.evaluate(() => window.scrollTo(0, (document.querySelector('.chart-latest')?.getBoundingClientRect().top ?? 0) + window.scrollY - 90))
await phone.waitForTimeout(300)
await shot('chart')
await tab(phone, 'Overview').click()
await phone.getByRole('link', { name: 'Explain the latest changes' }).click()
await phone.getByRole('button', { name: 'Show it' }).click()
await phone.getByRole('region', { name: 'What changed' }).scrollIntoViewIfNeeded()
await phone.evaluate(() => window.scrollBy(0, -80))
await shot('summary')
await tab(phone, 'Documents').click()
await readSample(phone)
await phone.getByRole('img', { name: 'The document' }).waitFor()
// Just the value to check, with the printed text it came from.
await closeUp(phone.locator('.review-row').first(), join(out, 'review.png'))
await tab(phone, 'Share').click()
await phone.getByRole('img', { name: 'Preview of the report' }).waitFor()
await phone.locator('.report-preview').scrollIntoViewIfNeeded()
await shot('report')

// Ask about the numbers: a suggested question, answered in advance for the demo.
const asker = await browser.newPage({ ...devices['iPhone 13'], colorScheme: 'light' })
await demo(asker)
await asker.getByRole('region', { name: 'Ask about the numbers' }).getByRole('link', { name: /percentile for weight mean/ }).click()
await asker.getByRole('button', { name: 'Ask', exact: true }).click()
await asker.getByRole('region', { name: 'Answer' }).waitFor()
// Just the conversation, so nothing sits under the translucent app bar or tab bar.
await closeUp(asker.locator('.ask-thread'), join(out, 'ask.png'))

// Dark mode, for the case study.
const dark = await browser.newPage({ ...devices['iPhone 13'], colorScheme: 'dark' })
await demo(dark)
await dark.screenshot({ path: join(out, 'child-dark.png') })
await tab(dark, 'Charts').click()
await dark.locator('.chart').waitFor()
await dark.evaluate(() => window.scrollTo(0, (document.querySelector('.chart-latest')?.getBoundingClientRect().top ?? 0) + window.scrollY - 90))
await dark.waitForTimeout(300)
await dark.screenshot({ path: join(out, 'chart-dark.png') })

// Desktop, at high resolution: the landing page and the app, for the README, case study and portfolio.
const hi = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light' })
await hi.goto(base)
await hi.waitForTimeout(900)
await hi.screenshot({ path: join(out, 'landing.png') })
await demo(hi)
await hi.screenshot({ path: join(out, 'overview-desktop.png') })
await closeUp(hi.locator('.gain-card'), join(out, 'gains.png'))

// Desktop: adding documents, with a repeated file set aside and an ultrasound image kept unread.
const wide = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, colorScheme: 'light' })
await demo(wide)
await tab(wide, 'Documents').click()
await wide.getByRole('link', { name: 'Add documents' }).first().click()
await wide.getByRole('button', { name: 'Add the sample document' }).click()
await wide.getByText('Already imported').waitFor()
// Made-up bytes with an ultrasound's file name: the queue shows the name and kind, not the image.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
await wide.getByLabel('Add PDFs, photos or zip files').setInputFiles({ name: 'ecografia-20-semanas.png', mimeType: 'image/png', buffer: png })
await wide.getByText('Keep without reading').first().waitFor()
await wide.mouse.move(0, 0)
await wide.screenshot({ path: join(out, 'import-queue.png') })

// The landing page's showcase images, from a fresh demo. Tall enough to show the review without
// scrolling, so the sticky app bar never overlaps the demo banner.
const wide2 = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' })
await demo(wide2)
await tab(wide2, 'Documents').click()
await readSample(wide2)
await wide2.getByRole('img', { name: 'The document' }).waitFor()
await wide2.waitForTimeout(500)
await wide2.screenshot({ path: join(landing, 'review.png') })
await wide2.screenshot({ path: join(out, 'review-desktop.png') })

// The share report itself, as the app exports it.
await tab(wide2, 'Share').click()
await wide2.getByRole('img', { name: 'Preview of the report' }).waitFor()
const download = wide2.waitForEvent('download')
await wide2.getByRole('button', { name: 'Save image' }).click()
const card = readFileSync(await (await download).path())
writeFileSync(join(landing, 'report.png'), card)
writeFileSync(join(out, 'report-card.png'), card)

await browser.close()
console.log(`Screenshots written to ${out} and ${landing}`)
