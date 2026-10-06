import { describe, expect, it } from 'vitest'
import { adjustedZ, formatPercentile, normalCdf, percentile, rawZ, round2 } from '../../src/growth/lms'
import { loadTables, lmsAt, tableRange } from '../../src/growth/tables'
import { adjustedStature, ageInDays, computeGrowth } from '../../src/growth/growth'

const tables = await loadTables()
// anthro converts months to days as round(months × 30.4375)
const monthsToDays = (m: number) => Math.round(m * 30.4375)

describe('WHO published examples', () => {
  // From WHO's anthro R package tests (github.com/WorldHealthOrganization/anthro, tests/testthat).
  it('weight-for-age: girl, 1522 days, 17 kg → 0.24', () => {
    expect(computeGrowth(tables, { ageDays: 1522, sex: 'female', weightKg: 17 }).wfa?.z).toBe(0.24)
  })

  it('length-for-age: boy, 44 days, 50 cm → −3.29', () => {
    expect(computeGrowth(tables, { ageDays: 44, sex: 'male', lengthCm: 50 }).lhfa?.z).toBe(-3.29)
  })

  it('a lying length after 2 years loses 0.7 cm: boy, 987 days, 72.86 cm → −6.09', () => {
    const g = computeGrowth(tables, { ageDays: 987, sex: 'male', lengthCm: 72.86 })
    expect(g.statureCm).toBeCloseTo(72.16, 6)
    expect(g.lhfa?.z).toBe(-6.09)
  })

  it('height at exactly 2 years: girl, 731 days, 77.5 cm → −2.55', () => {
    expect(computeGrowth(tables, { ageDays: 731, sex: 'female', heightCm: 77.5 }).lhfa?.z).toBe(-2.55)
  })

  it('a standing height under 2 years gains 0.7 cm: boy, 9 months, 60 cm → −5.02', () => {
    const g = computeGrowth(tables, { ageDays: monthsToDays(9), sex: 'male', heightCm: 60 })
    expect(g.statureCm).toBeCloseTo(60.7, 6)
    expect(g.lhfa?.z).toBe(-5.02)
  })

  // WHO 2006 report, p. 304: BMI-for-age, boys, with the report's monthly L, M and S.
  it.each([
    [{ L: -0.3067, M: 15.4013, S: 0.08115 }, 20.5, 3.4],
    [{ L: -0.485, M: 15.8667, S: 0.07818 }, 12, -3.76],
    [{ L: -0.4488, M: 15.2759, S: 0.0838 }, 18.8, 2.37],
  ])('restricted application beyond ±3 SD: %o, BMI %d → %d', (lms, bmi, expected) => {
    // The report rounds intermediate values, so allow 0.01.
    expect(Math.abs(adjustedZ(bmi, lms) - expected)).toBeLessThanOrEqual(0.0101)
  })
})

describe('the ±3 SD adjustment', () => {
  const day0 = { L: 0.3487, M: 3.3464, S: 0.14602 }
  it('applies beyond +3 and −3, not within', () => {
    expect(round2(adjustedZ(5.5, day0))).toBe(3.77)
    expect(round2(rawZ(5.5, day0))).toBe(3.72)
    expect(round2(adjustedZ(1.8, day0))).toBe(-3.74)
    expect(adjustedZ(3.3464, day0)).toBeCloseTo(0, 10)
  })

  it('is used for weight-based indicators only', () => {
    // Head circumference has L = 1, so its raw z-score is already linear.
    const g = computeGrowth(tables, { ageDays: 365, sex: 'female', headCm: 44 })
    expect(g.hcfa?.z).toBe(-0.66)
  })
})

describe('table edges', () => {
  it('covers day 0 to day 1856', () => {
    expect(tableRange(tables.wfa)).toEqual([0, 1856])
    expect(computeGrowth(tables, { ageDays: 0, sex: 'male', weightKg: 3.3464 }).wfa?.z).toBe(0)
    expect(computeGrowth(tables, { ageDays: 1856, sex: 'male', weightKg: 18 }).wfa).toBeDefined()
    expect(computeGrowth(tables, { ageDays: 1857, sex: 'male', weightKg: 18 }).wfa).toBeUndefined()
  })

  it('uses weight-for-length under 2 years and weight-for-height from 2', () => {
    expect(tableRange(tables.wfl)).toEqual([45, 110])
    expect(tableRange(tables.wfh)[0]).toBe(65)
    const baby = computeGrowth(tables, { ageDays: 200, sex: 'male', weightKg: 7.5, lengthCm: 66 })
    expect(baby.wfl).toBeDefined()
    expect(baby.wfh).toBeUndefined()
    const toddler = computeGrowth(tables, { ageDays: 800, sex: 'male', weightKg: 12, heightCm: 87 })
    expect(toddler.wfh).toBeDefined()
    expect(toddler.wfl).toBeUndefined()
  })

  it('interpolates between 0.1 cm rows and returns the exact row on the grid', () => {
    const a = lmsAt(tables.wfl, 'male', 65)!
    const b = lmsAt(tables.wfl, 'male', 65.1)!
    const mid = lmsAt(tables.wfl, 'male', 65.05)!
    expect(a.M).toBe(7.2666)
    expect(mid.M).toBeCloseTo((a.M + b.M) / 2, 10)
    expect(lmsAt(tables.wfl, 'male', 44.9)).toBeUndefined()
  })

  it('computes BMI from the adjusted stature', () => {
    const g = computeGrowth(tables, { ageDays: 300, sex: 'female', weightKg: 8, lengthCm: 70 })
    expect(g.bfa?.value).toBeCloseTo(8 / 0.7 ** 2, 10)
  })
})

describe('ages and statures', () => {
  it('counts whole days between dates', () => {
    expect(ageInDays('2026-04-01', '2026-04-01')).toBe(0)
    expect(ageInDays('2026-04-01', '2026-10-06')).toBe(188)
    expect(ageInDays('2024-02-29', '2026-03-01')).toBe(731)
  })

  it('switches length to height at 731 days', () => {
    expect(adjustedStature(730, 80)).toBe(80)
    expect(adjustedStature(731, 80)).toBeCloseTo(79.3, 10)
    expect(adjustedStature(730, undefined, 80)).toBeCloseTo(80.7, 10)
    expect(adjustedStature(731, undefined, 80)).toBe(80)
  })
})

describe('percentiles', () => {
  it('matches the normal distribution', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7)
    expect(percentile(1.881)).toBeCloseTo(97, 1)
    expect(percentile(-1.036)).toBeCloseTo(15, 1)
  })

  it('formats sensibly, including the extremes', () => {
    expect(formatPercentile(0)).toBe('50th')
    expect(formatPercentile(0.05)).toBe('52nd')
    expect(formatPercentile(-2.1)).toBe('2nd')
    expect(formatPercentile(-2.5)).toBe('0.6th')
    expect(formatPercentile(-3.5)).toBe('below the 0.1st')
    expect(formatPercentile(3.5)).toBe('above the 99.9th')
    expect(formatPercentile(-1.6)).toBe('5th')
    expect(formatPercentile(-1.1)).toBe('14th')
  })
})
