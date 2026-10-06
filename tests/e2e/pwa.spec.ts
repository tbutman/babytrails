import { test, expect } from './fixtures'

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
  await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible()
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await expect(page.getByRole('img', { name: /Weight for age/ })).toBeVisible()
  await context.setOffline(false)
})
