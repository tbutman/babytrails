import { test, expect, ANTHROPIC, startDemo, createVault, addChild, addMeasurement, saveApiKey } from './fixtures'

const TEST_KEY = 'sk-ant-test-' + 'y'.repeat(40)

test('demo: a prepared summary, labelled honestly', async ({ page }) => {
  await startDemo(page)
  await page.getByRole('link', { name: 'Explain the latest changes' }).click()
  await page.getByRole('button', { name: 'Show it' }).click()
  const card = page.getByRole('region', { name: 'What changed' })
  await expect(card).toContainText('90 g a week')
  await expect(card).toContainText('no AI was called')
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

    await createVault(page)
    await addChild(page, { name: 'Ines Exemplo', nickname: 'Nini', dob: '2026-03-01', sex: 'Girl' })
    await addMeasurement(page, { date: '2026-08-01', kg: '6,4', note: 'Nini liked the zebra' })
    await addMeasurement(page, { date: '2026-09-01', kg: '6,9', note: 'Nini liked the zebra' })
    await saveApiKey(page, TEST_KEY)

    await page.getByRole('link', { name: 'Explain the latest changes' }).click()
    expect(bodies).toHaveLength(0)
    await page.getByRole('button', { name: 'Send' }).click()

    const card = page.getByRole('region', { name: 'What changed' })
    await expect(card.locator('strong')).toHaveText('120 g a week')
    await expect(card).toContainText('<img src=x')
    expect(await card.locator('img, script').count()).toBe(0)
    expect(await page.title()).not.toMatch(/^[12]$/)

    expect(bodies).toHaveLength(1)
    for (const secret of ['Ines', 'Exemplo', 'Nini', '2026-03-01', '2026-08-01', '2026-09-01', 'zebra']) expect(bodies[0]).not.toContain(secret)
    expect(bodies[0]).toContain('weightGramsPerWeek')
  })
})
