import { readFileSync } from 'node:fs'
import { test, expect, ANTHROPIC, createVault, addChild, saveApiKey, tab } from './fixtures'

// A made-up key for the mock; it never reaches Anthropic.
const TEST_KEY = 'sk-ant-test-' + 'y'.repeat(40)
type Row = { cells: string[]; read: { weightKg?: number; statureCm?: number; headCm?: number }; source: string; confidence?: string }
const pt: { versions: number[]; rows: Row[] } = JSON.parse(readFileSync('tests/fixtures/booklet/rows-pt.json', 'utf8'))

// What a careful reader takes from the photo: rows as printed, grams marked as grams.
function answer(count: number) {
  return {
    measurements: pt.rows.slice(0, count).map((r) => {
      const grams = /^\d{4}$/.test(r.cells[2])
      return {
        date: r.cells[0],
        weight: r.read.weightKg === undefined ? null : grams ? Number(r.cells[2]) : r.read.weightKg,
        weight_unit: r.read.weightKg === undefined ? 'none' : grams ? 'g' : 'kg',
        length: r.read.statureCm ?? null,
        length_unit: r.read.statureCm === undefined ? 'none' : 'cm',
        length_kind: r.read.statureCm === undefined ? 'unknown' : 'lying',
        head: r.read.headCm ?? null,
        head_unit: r.read.headCm === undefined ? 'none' : 'cm',
        source_text: r.source,
        confidence: r.confidence ?? 'high',
        page: 1,
      }
    }),
  }
}

test.use({ allowAnthropic: true })

test('the same booklet page, photographed at three check-ups: only the new rows are checked each time', async ({ page }) => {
  let calls = 0
  await page.route(`${ANTHROPIC}/**`, async (route) => {
    const body = answer(pt.versions[calls++])
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }),
    })
  })

  await createVault(page)
  await addChild(page, { name: 'Teo Exemplo', dob: '2026-01-10', sex: 'Boy', birthKg: '3.60' })
  await saveApiKey(page, TEST_KEY)

  const steps = [
    { file: 'pt-1.jpg', saved: 0, fresh: 3 },
    { file: 'pt-2.jpg', saved: 3, fresh: 2 },
    { file: 'pt-3.jpg', saved: 5, fresh: 2 },
  ]
  for (const step of steps) {
    await tab(page, 'Documents').click()
    await page.getByRole('link', { name: 'Add documents' }).first().click()
    const name = `boletim-crescimento-${step.file}`
    await page.getByLabel('Add PDFs, photos or zip files').setInputFiles({ name, mimeType: 'image/jpeg', buffer: readFileSync(`tests/fixtures/booklet/${step.file}`) })
    await expect(page.getByLabel(`What is ${name}?`)).toHaveValue('booklet')
    await page.getByRole('button', { name: 'Read 1 document' }).click()
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByRole('heading', { name: 'Check document 1 of 1' })).toBeVisible()

    // A re-photographed page is not a duplicate: no offer to skip it, no question about the date order.
    await expect(page.getByText(/This looks like/)).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Date order' })).toHaveCount(0)
    if (step.saved) await expect(page.getByText(`${step.saved} rows already saved, left out`)).toBeVisible()
    const ticks = page.getByLabel('This matches the document')
    await expect(ticks).toHaveCount(step.fresh)
    for (const tick of await ticks.all()) await tick.check()
    await page.getByRole('button', { name: `Save ${step.fresh} rows` }).click()
    await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
  }

  // Birth plus the seven rows on the page, each once.
  await tab(page, 'Measurements').click()
  await expect(page.getByText('8 recorded')).toBeVisible()
  await expect(page.getByText(/−5\.8% from birth weight/)).toBeVisible()
  expect(calls).toBe(3)
})
