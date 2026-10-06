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
const tab = (page, name) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true })

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
await shot('chart')
await tab(phone, 'Overview').click()
await phone.getByRole('link', { name: 'Explain the latest changes' }).click()
await phone.getByRole('button', { name: 'Show it' }).click()
await phone.getByRole('region', { name: 'What changed' }).scrollIntoViewIfNeeded()
await phone.evaluate(() => window.scrollBy(0, -80))
await shot('summary')
await tab(phone, 'Documents').click()
await phone.getByRole('link', { name: /growth page \(sample\)/ }).click()
await phone.getByRole('link', { name: 'Read measurements with AI' }).click()
await phone.getByRole('button', { name: 'Show the review step' }).click()
await phone.getByLabel('This matches the document').first().check()
await phone.getByRole('img', { name: /page 1 of 1/ }).waitFor()
await phone.evaluate(() => {
  const source = document.querySelector('.review-source')
  window.scrollTo(0, (source?.getBoundingClientRect().top ?? 0) + window.scrollY + 40)
})
await shot('review')
await tab(phone, 'Share').click()
await phone.getByRole('img', { name: 'Preview of the report' }).waitFor()
await phone.locator('.report-preview').scrollIntoViewIfNeeded()
await shot('report')

// Dark mode, for the case study.
const dark = await browser.newPage({ ...devices['iPhone 13'], colorScheme: 'dark' })
await demo(dark)
await dark.screenshot({ path: join(out, 'child-dark.png') })

// Desktop: the landing page's showcase images, and wide screenshots of the landing page and app.
const wide = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, colorScheme: 'light' })
await wide.goto(base)
await wide.waitForTimeout(800)
await wide.screenshot({ path: join(out, 'landing.png') })
await demo(wide)
await wide.screenshot({ path: join(out, 'overview-desktop.png') })
await tab(wide, 'Documents').click()
await wide.getByRole('link', { name: /growth page \(sample\)/ }).click()
await wide.getByRole('link', { name: 'Read measurements with AI' }).click()
await wide.getByRole('button', { name: 'Show the review step' }).click()
await wide.getByLabel('This matches the document').first().check()
await wide.getByRole('img', { name: /page 1 of 1/ }).waitFor()
await wide.evaluate(() => window.scrollTo(0, (document.querySelector('.review')?.getBoundingClientRect().top ?? 0) + window.scrollY - 96))
await wide.screenshot({ path: join(landing, 'review.png') })

// The share report itself, as the app exports it.
await tab(wide, 'Share').click()
await wide.getByRole('img', { name: 'Preview of the report' }).waitFor()
const download = wide.waitForEvent('download')
await wide.getByRole('button', { name: 'Save image' }).click()
writeFileSync(join(landing, 'report.png'), readFileSync(await (await download).path()))

await browser.close()
console.log(`Screenshots written to ${out} and ${landing}`)
