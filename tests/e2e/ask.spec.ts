import { test, expect, ANTHROPIC, startDemo, createVault, addChild, addMeasurement, saveApiKey } from './fixtures'

// A made-up key for the mock; it never reaches Anthropic.
const TEST_KEY = 'sk-ant-test-' + 'z'.repeat(40)

test('demo: a suggested question gets an answer prepared in advance; your own needs a key', async ({ page }) => {
  await startDemo(page)
  const card = page.getByRole('region', { name: 'Ask about the numbers' })
  await card.getByRole('link', { name: "How does 90 g a week compare with WHO's weight gains at this age?" }).click()
  await expect(page.getByLabel('Your question')).toHaveValue("How does 90 g a week compare with WHO's weight gains at this age?")
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  const answer = page.getByRole('region', { name: 'Answer' })
  await expect(answer).toContainText('95 g a week')
  await expect(answer).toContainText('prepared in advance')

  await page.getByLabel('Ask a follow-up').fill('Will she be tall?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('try one of the suggested questions')
})

test.describe('with a mocked Anthropic API', () => {
  test.use({ allowAnthropic: true })

  test('questions are sent only after agreeing, without the name or dates, and unchecked numbers are withheld', async ({ page }) => {
    const bodies: string[] = []
    await page.route(`${ANTHROPIC}/**`, async (route) => {
      bodies.push(route.request().postData() ?? '')
      const first = bodies.length === 1
      const answer = first
        ? { kind: 'answer', text: 'The latest weight is **7.2 kg**.', numbers: [{ text: '7.2 kg', fact: 'latest.weightKg' }] }
        : { kind: 'answer', text: 'Most babies gain 150 g a week at this age.', numbers: [] }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }),
      })
    })

    await createVault(page)
    await addChild(page, { name: 'Sam Example', dob: '2026-03-01', sex: 'Girl' })
    await addMeasurement(page, { date: '2026-08-01', kg: '6.8', lengthCm: '65' })
    await addMeasurement(page, { date: '2026-09-01', kg: '7.2', lengthCm: '67' })
    await saveApiKey(page, TEST_KEY)

    await page.getByRole('link', { name: 'Ask your own question' }).click()
    await page.getByLabel('Your question').fill('How much does Sam Example weigh now?')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Send to Anthropic?' })).toBeVisible()
    expect(bodies).toHaveLength(0)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByRole('region', { name: 'Answer' })).toContainText('7.2 kg')
    expect(bodies[0]).not.toContain('Sam Example')
    expect(bodies[0]).toContain('How much does your baby weigh now?')
    expect(bodies[0]).not.toMatch(/2026-0[389]-01/)
    // The thread keeps the parent's own words.
    await expect(page.getByText('How much does Sam Example weigh now?')).toBeVisible()

    // A follow-up with the same facts needs no new agreement; an answer with numbers that aren't
    // the app's is retried once, then withheld.
    await page.getByLabel('Ask a follow-up').fill('Is that a usual gain?')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(page.getByText(/couldn't check this answer's numbers/)).toBeVisible()
    expect(bodies).toHaveLength(3)
    expect(bodies[1]).toContain('Earlier in this conversation')
    await expect(page.getByText('150 g a week')).toHaveCount(0)
  })
})
