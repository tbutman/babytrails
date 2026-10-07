// Accessibility: axe checks every screen against WCAG 2.1 A and AA, in the light and dark themes and
// at phone and desktop widths, and no screen may scroll sideways. Any violation fails the test, listed
// with the screen, the rule and the elements. Screens are reached by clicking through the demo, since
// it lives only in memory. (Adapted from LabTrails' a11y test, coordination request 16.)

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

type Found = { screen: string; rule: string; impact: string; help: string; targets: string[] }

async function check(page: Page, screen: string, found: Found[]) {
  // Let entrance transitions finish, so colours are measured at rest.
  await page.waitForTimeout(350)
  // No sideways scrolling: the page is never wider than the screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) found.push({ screen, rule: 'page-wider-than-screen', impact: 'serious', help: `The page is ${overflow}px wider than the screen`, targets: [] })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.passes.length, `axe ran its rules on ${screen}`).toBeGreaterThan(10)
  for (const v of results.violations) found.push({ screen, rule: v.id, impact: v.impact ?? '', help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) })
}

// The phone layout has a bottom bar and the desktop a top bar; click whichever is showing.
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Sections' }).filter({ visible: true }).getByRole('link', { name, exact: true }).click()
const h1 = (page: Page, name: string | RegExp) => expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

async function everyScreen(page: Page, found: Found[]) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, 'landing', found)

  await page.goto('/app')
  await expect(page.getByLabel('Passphrase', { exact: true })).toBeVisible()
  await check(page, 'create a vault', found)

  await page.goto('/app/about')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, 'about the data', found)

  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await h1(page, 'Robin')
  await check(page, 'overview', found)

  await page.getByRole('region', { name: 'Ask about the numbers' }).getByRole('link', { name: /percentile for weight mean/ }).click()
  await h1(page, 'Ask about the numbers')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Answer' })).toBeVisible()
  await check(page, 'ask', found)

  await nav(page, 'Charts')
  await h1(page, 'Growth charts')
  await check(page, 'charts', found)

  await nav(page, 'Measurements')
  await h1(page, 'Measurements')
  await check(page, 'measurements', found)

  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await h1(page, 'Add a measurement')
  await page.getByLabel(/Length, lying down/).fill('80')
  await expect(page.getByText(/far above the chart/)).toBeVisible()
  await check(page, 'add a measurement, with a warning', found)

  await nav(page, 'Documents')
  await h1(page, 'Documents')
  await check(page, 'documents', found)

  await page.getByRole('link', { name: 'Read', exact: true }).click()
  await page.getByRole('button', { name: 'Read 1 document' }).click()
  await h1(page, 'Check document 1 of 1')
  await check(page, 'review', found)

  await nav(page, 'Share')
  await h1(page, 'Share a report')
  await expect(page.getByRole('img', { name: 'Preview of the report' })).toBeVisible()
  await check(page, 'share', found)

  await nav(page, 'Overview')
  await page.getByRole('link', { name: 'Explain the latest changes' }).click()
  await page.getByRole('button', { name: 'Show it' }).click()
  await h1(page, 'Robin')
  await check(page, 'overview with a summary', found)
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of ['phone', 'desktop'] as const) {
    test(`no accessibility violations: ${colorScheme}, ${width}`, async ({ page }) => {
      // Every screen, with axe on each: about 9 s alone, and it timed out at 30 s when the whole
      // suite ran in parallel on a busy machine (X-10). Triple the time rather than retry.
      test.slow()
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize(width === 'desktop' ? { width: 1280, height: 900 } : { width: 375, height: 812 })
      const found: Found[] = []
      await everyScreen(page, found)
      expect(found, JSON.stringify(found, null, 2)).toEqual([])
    })
  }
}

test('keyboard and screen readers: a skip link, and each screen announced by its heading', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()

  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Robin' })).toBeFocused()
  await expect(page).toHaveTitle('Robin · BabyTrails')
  await nav(page, 'Charts')
  await expect(page.getByRole('heading', { level: 1, name: 'Growth charts' })).toBeFocused()
  await expect(page).toHaveTitle('Growth charts · BabyTrails')
})
