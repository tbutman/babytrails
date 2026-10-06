import { afterEach, describe, expect, it, vi } from 'vitest'
import { askQuestion } from '../../src/core/ask/ask'
import { checkAnswer, GROWTH_UNITS, historyText, measurementNumbers, resolveFact, type Answer } from '../../src/core/ask/model'
import { askFacts } from '../../src/app/askFacts'
import { DEMO_ANSWERS, demoData } from '../../src/app/demo'
import { ASK_BANNED, askSuggestions } from '../../src/app/prompts/ask'
import { loadTables } from '../../src/growth/tables'
import { formatPercentileValue } from '../../src/growth/lms'
import type { Child, Measurement } from '../../src/app/types'

const tables = await loadTables()
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
const answerReply = (a: Answer) => reply({ content: [{ type: 'text', text: JSON.stringify(a) }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' })

// Made-up values.
const child: Child = { id: 'c', name: 'Alexandra Example', nickname: 'Lexi', dateOfBirth: '2026-03-01', sex: 'female', createdAt: '2026-03-01T00:00:00Z' }
const m = (date: string, weightKg?: number, lengthCm?: number): Measurement => ({ id: date, childId: 'c', date, weightKg, lengthCm, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` })
const facts = askFacts(tables, child, [m('2026-07-01', 6.4, 63), m('2026-08-01', 6.8, 65), m('2026-09-01', 7.2, 67)], '2026-09-10')!
const WFA = `${formatPercentileValue(facts.latest.scores.wfa!.percentile)} percentile`

afterEach(() => vi.unstubAllGlobals())

describe('the facts sent with a question', () => {
  it('has ages, percentiles and references, and no name, date of birth or dates', () => {
    expect(facts.history.map((h) => h.ageDays)).toEqual([122, 153, 184])
    expect(facts.history[2].percentiles.weightForAge).toBe(facts.latest.scores.wfa?.percentile)
    expect(facts.references.whoChartPercentileLines).toEqual([3, 15, 50, 85, 97])
    const text = JSON.stringify(facts)
    expect(text).not.toMatch(/Alexandra|Lexi|2026-/)
  })

  it('suggests questions that fit the data', () => {
    const s = askSuggestions(facts, 'metric')
    expect(s.map((x) => x.id)).toEqual(['gain', 'percentile', 'length'])
    expect(s[0].text).toBe(`Is ${facts.gains.weight!.at(-1)!.perWeekGrams} g a week a usual weight gain at this age?`)
  })
})

describe('checking an answer', () => {
  const good: Answer = {
    kind: 'answer',
    text: `Weight went up by **${facts.gains.weight![1].perWeekGrams} g a week** and is on the ${WFA} now.`,
    numbers: [
      { text: `${facts.gains.weight![1].perWeekGrams} g a week`, fact: 'gains.weight[1].perWeekGrams' },
      { text: WFA, fact: 'latest.scores.wfa.percentile' },
    ],
  }

  it('finds facts by path', () => {
    expect(resolveFact(facts, 'gains.weight[1].perWeekGrams')).toBe(facts.gains.weight![1].perWeekGrams)
    expect(resolveFact(facts, 'references.whoChartPercentileLines[4]')).toBe(97)
    expect(resolveFact(facts, 'nope.nothing')).toBeUndefined()
  })

  it('finds the numbers that describe measurements, not ages or counts', () => {
    expect(measurementNumbers('7.5 kg at 6 months, 123 g a week, the 59th percentile, z of 0.22, 3 visits, −5.8%').map((t) => t.value)).toEqual([7.5, 123, 59, 0.22, -5.8])
  })

  it('passes an answer whose numbers all match the facts', () => {
    expect(checkAnswer(good, facts, ASK_BANNED)).toEqual({ ok: true, problems: [] })
  })

  it('withholds a number that differs from its fact, or one that was not declared', () => {
    const wrong = { ...good, numbers: [{ ...good.numbers[0], text: '200 g a week' }, good.numbers[1]] }
    expect(checkAnswer(wrong, facts).problems.join()).toMatch(/doesn't match gains\.weight\[1\]/)
    const extra = { ...good, text: `${good.text} Most babies gain 150 g a week at this age.` }
    expect(checkAnswer(extra, facts).problems.join()).toMatch(/"150 g" isn't one of the declared numbers/)
    const missing = { ...good, numbers: [{ text: '7.2 kg', fact: 'latest.weightKgg' }] }
    expect(checkAnswer(missing, facts).ok).toBe(false)
  })

  it('withholds reassurance and judgements', () => {
    for (const phrase of ['Your baby is healthy.', 'That is normal.', 'There is nothing to worry about.', 'Her weight looks fine.']) {
      expect(checkAnswer({ ...good, text: `${good.text} ${phrase}` }, facts, ASK_BANNED).ok).toBe(false)
    }
  })

  it('accepts the demo answers against the demo facts', () => {
    const { child: demo, measurements } = demoData()
    const demoFacts = askFacts(tables, demo, measurements, '2026-10-06')!
    for (const [id, a] of Object.entries(DEMO_ANSWERS)) expect(checkAnswer(a, demoFacts, ASK_BANNED), id).toEqual({ ok: true, problems: [] })
    expect(askSuggestions(demoFacts, 'metric').map((s) => s.id).every((id) => id in DEMO_ANSWERS)).toBe(true)
  })

  it('sends earlier turns as text, without withheld answers', () => {
    expect(historyText([
      { role: 'parent', text: 'Q1', createdAt: '' },
      { role: 'ai', kind: 'answer', text: 'A1', createdAt: '' },
      { role: 'parent', text: 'Q2', createdAt: '' },
      { role: 'ai', kind: 'unchecked', text: '', createdAt: '' },
    ])).toBe('Parent: Q1\n\nAnswer: A1\n\nParent: Q2')
  })
})

describe('the numbers check for other apps (LabTrails, request 15)', () => {
  // Made-up lab facts: a value stored in mg/dL and shown in mmol/L, with its lab's own range.
  const lab = { glucose: { value: 97, unit: 'mg/dL', shown: { value: 5.4, unit: 'mmol/L' }, range: { low: 70, high: 110 } } }
  const LAB_UNITS = [...GROWTH_UNITS, 'mg/dL', 'mmol/L', 'g/L', 'µIU/mL']

  it('finds numbers in the units the app passes, longest unit first', () => {
    expect(measurementNumbers('97 mg/dL, 5,4 mmol/L and 13 g/L', LAB_UNITS).map((t) => [t.value, t.raw])).toEqual([[97, '97 mg/dL'], [5.4, '5,4 mmol/L'], [13, '13 g/L']])
    // Growth units alone don't see lab units, so a lab app must pass its own.
    expect(measurementNumbers('97 mg/dL', GROWTH_UNITS)).toEqual([])
  })

  it('accepts a value as the app shows it in another unit, with a decimal comma', () => {
    const a: Answer = { kind: 'answer', text: 'Glucose was **5,4 mmol/L** (97 mg/dL).', numbers: [{ text: '5,4 mmol/L', fact: 'glucose.shown.value' }, { text: '97 mg/dL', fact: 'glucose.value' }] }
    expect(checkAnswer(a, lab, [], LAB_UNITS)).toEqual({ ok: true, problems: [] })
    const undeclared = { ...a, text: `${a.text} It was 6,1 mmol/L before.` }
    expect(checkAnswer(undeclared, lab, [], LAB_UNITS).problems.join()).toMatch(/"6,1 mmol\/L" isn't one of the declared numbers/)
  })

  it("accepts the lab's own range as a fact", () => {
    const a: Answer = { kind: 'answer', text: 'The range on that report was 70 to 110 mg/dL.', numbers: [{ text: '70', fact: 'glucose.range.low' }, { text: '110 mg/dL', fact: 'glucose.range.high' }] }
    expect(checkAnswer(a, lab, [], LAB_UNITS).ok).toBe(true)
  })
})

describe('asking', () => {
  const base = { apiKey: 'k', model: 'm', system: 's', factsText: 'facts', facts, history: [], question: 'How is the weight?', banned: ASK_BANNED }
  const bad: Answer = { kind: 'answer', text: 'Babies gain 150 g a week.', numbers: [] }
  const good: Answer = { kind: 'answer', text: `It is on the ${WFA}.`, numbers: [{ text: WFA, fact: 'latest.scores.wfa.percentile' }] }

  it('retries once, telling the AI what failed, then returns a checked answer', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(answerReply(bad)).mockResolvedValueOnce(answerReply(good))
    vi.stubGlobal('fetch', fetch)
    const out = await askQuestion(base)
    expect(out).toMatchObject({ answer: good })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[1][1].body).messages[0].content[0].text).toMatch(/withheld because: "150 g" isn't one of the declared numbers/)
  })

  it('withholds an answer that fails twice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(answerReply(bad))))
    expect(await askQuestion(base)).toMatchObject({ withheld: [expect.stringMatching(/150 g/)] })
  })

  it('passes an out-of-scope reply through without checking', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answerReply({ kind: 'out-of-scope', text: '', numbers: [] })))
    expect(await askQuestion(base)).toMatchObject({ answer: { kind: 'out-of-scope' } })
  })
})
