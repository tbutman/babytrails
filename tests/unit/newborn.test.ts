import { describe, expect, it } from 'vitest'
import { birthMeasurement, formatPercentChange, newborn } from '../../src/app/newborn'
import { buildFacts } from '../../src/app/facts'
import { loadTables } from '../../src/growth/tables'
import type { Child, Measurement } from '../../src/app/types'

const tables = await loadTables()
// Made-up values.
const child: Child = { id: 'c', name: 'Test Baby', dateOfBirth: '2026-05-01', sex: 'female', createdAt: '2026-05-01T00:00:00Z' }
const m = (date: string, weightKg?: number, extra: Partial<Measurement> = {}): Measurement => ({
  id: date, childId: 'c', date, weightKg, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`, ...extra,
})

describe('the first weeks', () => {
  it('finds the birth weight: marked as birth first, else on the date of birth', () => {
    expect(birthMeasurement(child, [m('2026-05-01', 3.4), m('2026-05-03', 3.2)])?.weightKg).toBe(3.4)
    expect(birthMeasurement(child, [m('2026-05-01', 3.4), { ...m('2026-05-01', 3.5, { birth: true }), id: 'b' }])?.weightKg).toBe(3.5)
    expect(newborn(child, [m('2026-05-05', 3.2)])).toBeNull()
  })

  it('works out the change from birth weight, the lowest point and when it was regained', () => {
    const nb = newborn(child, [m('2026-05-01', 3.5), m('2026-05-04', 3.22), m('2026-05-08', 3.3), m('2026-05-13', 3.52), m('2026-06-10', 4.6)])!
    expect(nb.weighings.map((w) => w.ageDays)).toEqual([3, 7, 12])
    expect(nb.lowest?.ageDays).toBe(3)
    expect(formatPercentChange(nb.lowest!.percentFromBirth)).toBe('−8.0%')
    expect(nb.regainedByDay).toBe(12)
    expect(nb.lostMoreThan10).toBe(false)
    expect(nb.notRegainedBy3Weeks).toBe(false)
  })

  it('flags more than 10% lost in the first two weeks, and not back by 3 weeks (NICE NG75)', () => {
    const data = [m('2026-05-01', 3.5), m('2026-05-05', 3.1), m('2026-05-23', 3.4)]
    const nb = newborn(child, data)!
    expect(nb.lostMoreThan10).toBe(true)
    expect(nb.notRegainedBy3Weeks).toBe(true)
    const facts = buildFacts(tables, child, data, '2026-05-24')!
    const reasons = facts.worthMentioning.map((f) => f.reason)
    expect(reasons).toContain('weight was more than 10% below birth weight in the first two weeks')
    expect(reasons).toContain('weight was not back to birth weight by 3 weeks of age')
    expect(facts.newborn).toEqual({ birthWeightKg: 3.5, lowestPercentFromBirth: -11.4, lowestAtAgeDays: 4, backToBirthWeightByAgeDays: undefined })
  })

  it('stops flagging the first weeks once the baby is older', () => {
    const data = [m('2026-05-01', 3.5), m('2026-05-05', 3.1), m('2026-05-23', 3.4), m('2026-07-01', 5.0)]
    const facts = buildFacts(tables, child, data, '2026-07-02')!
    expect(facts.worthMentioning.map((f) => f.reason).join()).not.toMatch(/birth weight/)
    expect(facts.newborn?.birthWeightKg).toBe(3.5)
  })
})

describe('flags about changes, not positions', () => {
  it('flags a measurement outside the band when it gets there, then lists it as still outside', () => {
    const big = [m('2026-07-01', 4.9), m('2026-08-01', 8.0), m('2026-09-01', 9.0)]
    const first = buildFacts(tables, child, big.slice(0, 2), '2026-08-02')!
    expect(first.worthMentioning.map((f) => f.reason)).toContain('weight for age is above the 97th percentile')
    const again = buildFacts(tables, child, big, '2026-09-02')!
    expect(again.worthMentioning.map((f) => f.reason)).not.toContain('weight for age is above the 97th percentile')
    expect(again.stillOutside).toEqual([{ indicator: 'wfa', side: 'above the 97th' }])
  })
})
