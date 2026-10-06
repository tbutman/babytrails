import { describe, expect, it } from 'vitest'
import { allIntervals, intervals, versusSameLine } from '../../src/app/gains'
import { adjustedZ, valueAtAdjustedZ } from '../../src/growth/lms'
import { computeGrowth } from '../../src/growth/growth'
import { loadTables, lmsAt } from '../../src/growth/tables'
import type { Child, Measurement } from '../../src/app/types'

const tables = await loadTables()
// Made-up values throughout.
const child: Child = { id: 'c', name: 'Test Baby', dateOfBirth: '2026-01-01', sex: 'male', createdAt: '2026-01-01T00:00:00Z' }
const m = (date: string, weightKg?: number, lengthCm?: number, headCm?: number): Measurement => ({
  id: date, childId: 'c', date, weightKg, lengthCm, headCm, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`,
})

describe('valueAtAdjustedZ', () => {
  it('inverts adjustedZ, including beyond ±3 SD', () => {
    const lms = lmsAt(tables.wfa, 'male', 120)!
    for (const z of [-5, -3.5, -3, -1, 0, 1.4, 3, 3.6, 5]) expect(adjustedZ(valueAtAdjustedZ(lms, z), lms)).toBeCloseTo(z, 9)
  })
})

describe('gain over time', () => {
  const data = [m('2026-01-01', 3.5, 50, 35), m('2026-02-01', 4.6), m('2026-03-01', 5.6, 58, 39), m('2026-03-04', 5.62), m('2026-04-01', 6.3, 61.5, 40.5)]

  it('pairs consecutive measurements of each kind, skipping visits without that value', () => {
    const all = allIntervals(tables, child, data)
    expect(all.weight.map((i) => [i.from.date, i.to.date])).toEqual([
      ['2026-01-01', '2026-02-01'], ['2026-02-01', '2026-03-01'], ['2026-03-01', '2026-03-04'], ['2026-03-04', '2026-04-01'],
    ])
    expect(all.length.map((i) => [i.from.date, i.to.date])).toEqual([['2026-01-01', '2026-03-01'], ['2026-03-01', '2026-04-01']])
    expect(all.head).toHaveLength(2)
  })

  it('gives weight per week and length per month', () => {
    const [w] = intervals(tables, child, data, 'weight')
    expect(w.days).toBe(31)
    expect(w.rate).toBeCloseTo((1.1 / 31) * 7, 10)
    const [l] = intervals(tables, child, data, 'length')
    expect(l.days).toBe(59)
    expect(l.rate).toBeCloseTo((8 / 59) * 30.4375, 10)
  })

  it('marks intervals too short to say much', () => {
    const w = intervals(tables, child, data, 'weight')
    expect(w.map((i) => i.short)).toEqual([false, false, true, false])
  })

  it('works out the gain that keeps the same z-score', () => {
    const [w] = intervals(tables, child, data, 'weight')
    const z0 = computeGrowth(tables, { ageDays: 0, sex: 'male', weightKg: 3.5 }).wfa!.z
    // Staying on the line means reaching the weight at the same z-score 31 days later.
    const target = valueAtAdjustedZ(lmsAt(tables.wfa, 'male', 31)!, z0)
    expect(w.sameLine).toBeCloseTo(((target - 3.5) / 31) * 7, 2)
    // A baby who gains exactly that keeps his percentile.
    const steady = intervals(tables, child, [m('2026-01-01', 3.5), m('2026-02-01', target)], 'weight')[0]
    expect(versusSameLine(steady)).toBe('about the same')
    expect(steady.toZ).toBeCloseTo(steady.fromZ!, 1)
  })

  it('compares a rate with the same-line rate in words', () => {
    const base = intervals(tables, child, [m('2026-01-01', 3.5), m('2026-02-01', 4.6)], 'weight')[0]
    expect(versusSameLine({ ...base, rate: base.sameLine! * 1.5 })).toBe('more')
    expect(versusSameLine({ ...base, rate: base.sameLine! * 0.5 })).toBe('less')
    expect(versusSameLine({ ...base, rate: base.sameLine! * 1.05 })).toBe('about the same')
    expect(versusSameLine({ ...base, sameLine: undefined })).toBeUndefined()
  })

  it('uses WHO length after the 0.7 cm adjustment across the 2-year switch', () => {
    const older = [m('2027-12-01', undefined, 86), { ...m('2028-02-01'), heightCm: 87.5 }]
    const [l] = intervals(tables, child, older, 'length')
    // 86 cm lying at under 2 years stays 86; 87.5 cm standing at over 2 years stays 87.5.
    expect(l.change).toBeCloseTo(1.5, 10)
  })
})
