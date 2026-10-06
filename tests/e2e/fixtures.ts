// Every browser test checks the network allow-list: the app may only request its own origin. Tests
// that exercise AI features also allow Anthropic's API, which they answer with a mock (no real request
// ever leaves the test).

import { test as base, expect, type Page } from '@playwright/test'

export const ANTHROPIC = 'https://api.anthropic.com'

export const test = base.extend<{ allowAnthropic: boolean; requests: string[] }>({
  allowAnthropic: [false, { option: true }],
  requests: [
    async ({ page, baseURL, allowAnthropic }, use) => {
      const requests: string[] = []
      page.on('request', (request) => requests.push(request.url()))
      await use(requests)
      const allowed = new Set([new URL(baseURL!).origin, ...(allowAnthropic ? [ANTHROPIC] : [])])
      const outside = requests.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:') && !allowed.has(new URL(url).origin))
      expect(outside, 'requests to origins that are not allowed').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

// Steps many tests share, written against what a user sees.

export const PASS = 'maple orbit velvet canoe'

export async function startDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByRole('heading', { name: 'Robin' })).toBeVisible()
}

export async function createVault(page: Page) {
  await page.goto('/app')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
  await page.getByLabel('Passphrase again').fill(PASS)
  await page.getByLabel(/no way to reset it/).check()
  await page.getByRole('button', { name: 'Create the vault' }).click()
}

export async function addChild(page: Page, { name, dob, sex, nickname }: { name: string; dob: string; sex: 'Girl' | 'Boy'; nickname?: string }) {
  await page.getByRole('link', { name: 'Add a child' }).first().click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  if (nickname) await page.getByLabel('Nickname (optional)').fill(nickname)
  await page.getByLabel('Date of birth').fill(dob)
  await page.getByLabel(sex, { exact: true }).check()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: nickname ?? name })).toBeVisible()
}

export async function addMeasurement(page: Page, { date, kg, lengthCm, note }: { date: string; kg?: string; lengthCm?: string; note?: string }) {
  await page.getByRole('link', { name: 'Add a measurement' }).first().click()
  await page.getByLabel('Date', { exact: true }).fill(date)
  if (kg) await page.getByLabel('Weight (kg)').fill(kg)
  if (lengthCm) await page.getByLabel(/Length, lying down/).fill(lengthCm)
  if (note) await page.getByLabel('Note (optional)').fill(note)
  await page.getByRole('button', { name: 'Save' }).click()
}

export async function saveApiKey(page: Page, key: string) {
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('Anthropic API key').fill(key)
  await page.getByRole('button', { name: 'Save key' }).click()
  await expect(page.getByText(new RegExp(`ending in …${key.slice(-4)}`))).toBeVisible()
  await page.getByRole('link', { name: 'BabyTrails home' }).click()
}

export const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true })
