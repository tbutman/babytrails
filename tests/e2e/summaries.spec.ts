import { test, expect, ANTHROPIC } from './fixtures'

const PASS = 'maple orbit velvet canoe'
const TEST_KEY = 'sk-ant-test-' + 'y'.repeat(40)

test('demo: a prepared summary, labelled as AI output', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await page.getByRole('link', { name: 'Explain the latest changes' }).click()
  await page.getByRole('button', { name: 'Show it' }).click()
  const card = page.getByRole('region', { name: 'What changed' })
  await expect(card).toContainText('90 g a week')
  await expect(card).toContainText('No AI was called')
})

test.describe('with a mocked Anthropic API', () => {
  test.use({ allowAnthropic: true })

  test('summaries send computed facts without the name, and show AI text as text', async ({ page }) => {
    const bodies: string[] = []
    await page.route(`${ANTHROPIC}/**`, async (route) => {
      bodies.push(route.request().postData() ?? '')
      const text = 'Weight went up by **120 g a week**.\n\n<img src=x onerror="document.title=1"> <script>document.title=2</script>'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
    await page.getByLabel('Type it again').fill(PASS)
    await page.getByLabel(/can't be reset/).check()
    await page.getByRole('button', { name: 'Create my vault' }).click()
    await page.getByRole('link', { name: 'Add a child' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Ines Exemplo')
    await page.getByLabel('Nickname (optional)').fill('Nini')
    await page.getByLabel('Date of birth').fill('2026-03-01')
    await page.getByRole('button', { name: 'Girl' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    for (const [date, kg] of [['2026-08-01', '6,4'], ['2026-09-01', '6,9']]) {
      await page.getByRole('link', { name: 'Add a measurement' }).click()
      await page.getByLabel('Date').fill(date)
      await page.getByLabel('Weight (kg)').fill(kg)
      await page.getByLabel('Note (optional)').fill('Nini liked the zebra')
      await page.getByRole('button', { name: 'Save' }).click()
    }
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByLabel('Anthropic API key').fill(TEST_KEY)
    await page.getByRole('button', { name: 'Save key' }).click()
    await page.getByRole('link', { name: 'BabyTrails home' }).click()

    await page.getByRole('link', { name: 'Explain the latest changes' }).click()
    expect(bodies).toHaveLength(0)
    await page.getByRole('button', { name: 'Send' }).click()

    const card = page.getByRole('region', { name: 'What changed' })
    await expect(card.locator('strong')).toHaveText('120 g a week')
    await expect(card).toContainText('<img src=x')
    expect(await card.locator('img, script').count()).toBe(0)
    expect(await page.title()).not.toMatch(/^[12]$/)

    expect(bodies).toHaveLength(1)
    for (const secret of ['Ines', 'Exemplo', 'Nini', '2026-03-01', 'zebra']) expect(bodies[0]).not.toContain(secret)
    expect(bodies[0]).toContain('weightGramsPerWeek')
  })
})
