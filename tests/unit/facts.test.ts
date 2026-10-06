import { describe, expect, it } from 'vitest'
import { buildFacts, factsDigest } from '../../src/app/facts'
import { loadTables } from '../../src/growth/tables'
import type { Child, Measurement } from '../../src/app/types'

const tables = await loadTables()
const child: Child = { id: 'c', name: 'Alexandra Example', dateOfBirth: '2026-03-01', sex: 'female', createdAt: '2026-03-01T00:00:00Z' }
const m = (date: string, weightKg?: number, lengthCm?: number): Measurement => ({
  id: date, childId: 'c', date, weightKg, lengthCm, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`,
})

describe('summary facts', () => {
  it('computes the change and percentiles, with no name or date of birth', () => {
    const facts = buildFacts(tables, child, [m('2026-08-01', 6.4, 63), m('2026-09-01', 6.8, 65)], '2026-09-10')!
    expect(facts.baby).toEqual({ sex: 'girl', ageDaysToday: 193, bornAtWeeks: undefined })
    expect(facts.change?.days).toBe(31)
    expect(facts.change?.weightGramsPerWeek).toBe(Math.round((400 / 31) * 7))
    expect(facts.change?.lengthOrHeightCmChange).toBe(2)
    expect(facts.latest.scores.wfa?.percentile).toBeGreaterThan(0)
    const text = JSON.stringify(facts)
    expect(text).not.toContain('Alexandra')
    expect(text).not.toContain('2026-03-01')
  })

  it('flags big percentile moves, weight loss and values outside the 3rd–97th band', () => {
    const facts = buildFacts(tables, child, [m('2026-07-01', 7.0), m('2026-09-01', 5.6)], '2026-09-10')!
    const reasons = facts.worthMentioning.map((f) => f.reason).join(' | ')
    expect(reasons).toContain('weight went down')
    expect(reasons).toContain('moved from about the')
    expect(reasons).toContain('below the 3rd percentile')
  })

  it('flags nothing for steady growth along a percentile', () => {
    const facts = buildFacts(tables, child, [m('2026-08-01', 6.4), m('2026-09-01', 6.9)], '2026-09-10')!
    expect(facts.worthMentioning).toEqual([])
  })

  it('lists recent gains by age, with the same-line reference, and never a date', () => {
    const data = [m('2026-05-01', 5.4), m('2026-06-01', 6.0, 61), m('2026-06-04', 6.05), m('2026-07-01', 6.5, 63.5), m('2026-08-01', 6.9, 65)]
    const facts = buildFacts(tables, child, data, '2026-08-10')!
    const w = facts.gains.weight!
    expect(w.map((g) => [g.fromAgeDays, g.toAgeDays, g.days])).toEqual([[61, 92, 31], [92, 95, 3], [95, 122, 27], [122, 153, 31]])
    expect(w[0].perWeekGrams).toBe(Math.round((600 / 31) * 7))
    expect(w[0].sameLinePerWeekGrams).toBeGreaterThan(0)
    expect(w[0].comparedWithSameLine).toBeDefined()
    expect(w[1]).toMatchObject({ tooShortToCompare: true })
    expect(w[1].sameLinePerWeekGrams).toBeUndefined()
    expect(facts.gains.length!.map((g) => g.perMonthCm)).toEqual([Math.round((2.5 / 30) * 30.4375 * 10) / 10, Math.round((1.5 / 31) * 30.4375 * 10) / 10])
    expect(JSON.stringify(facts.gains)).not.toMatch(/2026-/)
  })

  it('sends at most six intervals per kind', () => {
    const data = Array.from({ length: 10 }, (_, i) => m(`2026-0${Math.floor(i / 3) + 4}-${String((i % 3) * 9 + 1).padStart(2, '0')}`, 5 + i * 0.2))
    expect(buildFacts(tables, child, data, '2026-08-10')!.gains.weight).toHaveLength(6)
  })

  it('changes its digest when the data changes', async () => {
    const a = await factsDigest(buildFacts(tables, child, [m('2026-09-01', 6.8)], '2026-09-10')!)
    const b = await factsDigest(buildFacts(tables, child, [m('2026-09-01', 6.9)], '2026-09-10')!)
    expect(a).not.toBe(b)
  })
})
