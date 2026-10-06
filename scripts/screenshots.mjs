// Takes the README and case-study screenshots from the demo (made-up data only), at phone size,
// against a running build: npm run build && npx vite preview --port 4190, then
//   node scripts/screenshots.mjs [http://localhost:4190]

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:4190'
const out = join(dirname(fileURLToPath(import.meta.url)), '../docs/screenshots')
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
const page = await browser.newPage({ ...devices['iPhone 13'], colorScheme: 'light' })
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) })

await page.goto(base)
await shot('welcome')
await page.getByRole('button', { name: 'Try the demo' }).click()
await page.getByRole('heading', { name: 'Robin' }).waitFor()
await page.waitForTimeout(500)
await shot('child')
await page.locator('.chart').scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollBy(0, -60))
await shot('chart')
await page.getByRole('link', { name: 'Explain the latest changes' }).click()
await page.getByRole('button', { name: 'Show it' }).click()
await page.getByRole('region', { name: 'What changed' }).scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollBy(0, -80))
await shot('summary')
await page.getByRole('link', { name: 'Documents' }).click()
await page.getByRole('link', { name: /growth page \(sample\)/ }).click()
await page.getByRole('link', { name: 'Read measurements with AI' }).click()
await page.getByRole('button', { name: 'Show the review step' }).click()
await page.getByLabel('This matches the document').first().check()
await page.getByRole('img', { name: /page 1 of 1/ }).waitFor()
await page.evaluate(() => {
  const source = document.querySelector('.review-source')
  window.scrollTo(0, (source?.getBoundingClientRect().top ?? 0) + window.scrollY + 40)
})
await shot('review')
await page.getByRole('button', { name: 'Cancel' }).click()
await page.getByRole('link', { name: 'Back' }).click()
await page.getByRole('link', { name: 'Back' }).click()
await page.getByRole('link', { name: 'Share a report' }).click()
await page.getByRole('img', { name: 'Preview of the report' }).waitFor()
await page.locator('.report-preview').scrollIntoViewIfNeeded()
await shot('report')

// Dark mode, for the case study.
const dark = await browser.newPage({ ...devices['iPhone 13'], colorScheme: 'dark' })
await dark.goto(base)
await dark.getByRole('button', { name: 'Try the demo' }).click()
await dark.getByRole('heading', { name: 'Robin' }).waitFor()
await dark.waitForTimeout(500)
await dark.screenshot({ path: join(out, 'child-dark.png') })
await browser.close()
console.log(`Screenshots written to ${out}`)
