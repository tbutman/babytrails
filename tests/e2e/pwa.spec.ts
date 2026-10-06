import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from './fixtures'
import { serveCopyOfBuild } from './staticServer'

test('installable, and opens offline once visited', async ({ page, context }) => {
  await page.goto('/')
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href')
    return href ? (await fetch(href)).json() : null
  })
  expect(manifest).toMatchObject({ name: 'BabyTrails', display: 'standalone', start_url: '/' })
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)

  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Try the demo' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByRole('heading', { name: 'Robin' })).toBeVisible()
  await context.setOffline(false)
})

test('a new version waits for the user to tap Reload', async ({ browser }) => {
  // Its own server and browser context: this test changes the served files, like a deploy.
  const site = await serveCopyOfBuild()
  const context = await browser.newContext({ baseURL: site.url })
  const page = await context.newPage()
  try {
    await page.goto('/')
    // The first visit installs the service worker; it controls pages from the next load.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    await page.reload()
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    // Start the demo, so we can tell whether the page reloads by itself.
    await page.getByRole('button', { name: 'Try the demo' }).first().click()
    await expect(page.getByRole('heading', { name: 'Robin' })).toBeVisible()

    // A deploy: the server now has a different service worker.
    const sw = join(site.root, 'sw.js')
    appendFileSync(sw, '\n// a new version\n')
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update())

    const banner = page.getByRole('status').filter({ hasText: 'A new version of BabyTrails is ready' })
    await expect(banner).toBeVisible()
    // Nothing reloads by itself: the demo is still open.
    await expect(page.getByRole('heading', { name: 'Robin' })).toBeVisible()

    await banner.getByRole('button', { name: 'Reload' }).click()
    await expect(page.getByRole('button', { name: 'Try the demo' }).first()).toBeVisible()
    await expect(banner).toHaveCount(0)
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false)
  } finally {
    await context.close()
    await site.close()
  }
})
