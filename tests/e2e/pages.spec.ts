import { readFileSync } from 'node:fs'
import { test, expect, ANTHROPIC, createVault, addChild, saveApiKey, tab } from './fixtures'

// A made-up key for the mock; it never reaches Anthropic.
const TEST_KEY = 'sk-ant-test-' + 'p'.repeat(40)
const row = (date: string, weight: number, length: number, head: number, page: number) => ({
  date, weight, weight_unit: 'kg', length, length_unit: 'cm', length_kind: 'lying', head, head_unit: 'cm', source_text: `${date} ${weight} ${length} ${head}`, confidence: 'high', page,
})

test.use({ allowAnthropic: true })

test('photos of one document: grouped in order, read together, checked once, kept as one document', async ({ page }) => {
  const bodies: string[] = []
  await page.route(`${ANTHROPIC}/**`, async (route) => {
    bodies.push(route.request().postData() ?? '')
    // Made-up values, one row on each page.
    const answer = { measurements: [row('10/02/2026', 4.52, 55.5, 37.8, 1), row('10/03/2026', 5.61, 59, 39.5, 2)] }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }),
    })
  })

  await createVault(page)
  await addChild(page, { name: 'Teo Exemplo', dob: '2026-01-10', sex: 'Boy' })
  await saveApiKey(page, TEST_KEY)
  await tab(page, 'Documents').click()
  await page.getByRole('link', { name: 'Add documents' }).first().click()
  await page.getByLabel('Add PDFs, photos or zip files').setInputFiles([
    { name: 'boletim-folha-b.jpg', mimeType: 'image/jpeg', buffer: readFileSync('tests/fixtures/booklet/pt-2.jpg') },
    { name: 'boletim-folha-a.jpg', mimeType: 'image/jpeg', buffer: readFileSync('tests/fixtures/booklet/pt-1.jpg') },
  ])

  // Pick the photos in page order: a, then b.
  await page.getByRole('button', { name: 'Pages of one document?' }).click()
  const pick = (name: string) => page.getByRole('listitem').filter({ hasText: name }).getByRole('checkbox', { name: /Add as a page|Page \d/ })
  await pick('boletim-folha-a.jpg').check()
  await pick('boletim-folha-b.jpg').check()
  await page.getByRole('button', { name: 'Make these 2 photos one document' }).click()
  const pages = page.getByRole('list', { name: /Pages of boletim-folha-a\.jpg/ })
  await expect(pages.getByRole('listitem')).toHaveText([/Page 1\s*boletim-folha-a\.jpg/, /Page 2\s*boletim-folha-b\.jpg/])

  // One request, with both pages in order.
  await page.getByRole('button', { name: 'Read 1 document' }).click()
  await expect(page.getByText(/2 photos/)).toBeVisible()
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('heading', { name: 'Check document 1 of 1' })).toBeVisible()
  expect(bodies).toHaveLength(1)
  const content = JSON.parse(bodies[0]).messages[0].content as { type: string; text?: string }[]
  expect(content.filter((b) => b.type === 'image')).toHaveLength(2)
  expect(content.at(-1)?.text).toContain('pages 1 to 2 of one document')

  // The review pages through the group, and a row's "Show page" goes to its page.
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  // 10/02 and 10/03 could be either order, so the parent says which.
  await page.getByRole('group', { name: 'Date order' }).getByRole('button', { name: /Day first/ }).click()
  for (const tick of await page.getByLabel('This matches the document').all()) await tick.check()
  await page.getByRole('button', { name: 'Save 2 rows' }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  // Listed once, with its pages; its page shows them all.
  await expect(page.getByRole('heading', { name: /All documents · 1/ })).toBeVisible()
  await page.getByRole('link', { name: /boletim-folha-a\.jpg.*2 pages/ }).click()
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await tab(page, 'Measurements').click()
  await expect(page.getByText('2 recorded')).toBeVisible()
})
