import { describe, expect, it } from 'vitest'
import { CM_FIELD, cmToIn, formatLength, formatWeeklyGain, formatWeight, IN_FIELD, inToCm, KG_FIELD, kgToLbOz, lbOzToKg, parseAmount, parseDecimal } from '../../src/growth/units'

describe('units', () => {
  it('converts weight both ways', () => {
    expect(kgToLbOz(3.5)).toEqual({ lb: 7, oz: 11.5 })
    expect(lbOzToKg(7, 11.5)).toBeCloseTo(3.5012, 4)
    expect(lbOzToKg(1, 0)).toBe(0.45359237)
    for (const kg of [2.1, 3.456, 7.9, 12.34]) {
      const { lb, oz } = kgToLbOz(kg)
      expect(Math.abs(lbOzToKg(lb, oz) - kg)).toBeLessThan(0.002)
    }
  })

  it('handles ounces that round up to a whole pound', () => {
    expect(kgToLbOz(lbOzToKg(7, 15.99))).toEqual({ lb: 8, oz: 0 })
  })

  it('converts length both ways', () => {
    expect(cmToIn(2.54)).toBe(1)
    expect(inToCm(cmToIn(67.3))).toBeCloseTo(67.3, 10)
  })

  it('formats for display', () => {
    expect(formatWeight(7.9, 'metric')).toBe('7.90 kg')
    expect(formatWeight(12.34, 'metric')).toBe('12.3 kg')
    expect(formatWeight(3.5, 'imperial')).toBe('7 lb 11.5 oz')
    expect(formatLength(67, 'metric')).toBe('67.0 cm')
    expect(formatLength(67, 'imperial')).toBe('26.4 in')
    expect(formatWeeklyGain(0.15, 'metric')).toBe('150 g a week')
    expect(formatWeeklyGain(-0.02, 'metric')).toBe('−20 g a week')
    expect(formatWeeklyGain(0.15, 'imperial')).toBe('5.3 oz a week')
  })

  it('parses decimal commas and rejects junk', () => {
    expect(parseDecimal('7,9')).toBe(7.9)
    expect(parseDecimal(' 7.9 ')).toBe(7.9)
    expect(parseDecimal('7')).toBe(7)
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('7.9kg')).toBeUndefined()
    expect(parseDecimal('-1')).toBeUndefined()
  })
})

import { formatAge } from '../../src/app/format'

describe('ages', () => {
  it('counts calendar months then days', () => {
    expect(formatAge('2026-04-01', '2026-04-01')).toBe('0 days')
    expect(formatAge('2026-04-01', '2026-04-13')).toBe('12 days')
    expect(formatAge('2026-04-01', '2026-10-19')).toBe('6 months, 18 days')
    expect(formatAge('2026-01-31', '2026-03-01')).toBe('1 month, 1 day')
    expect(formatAge('2024-03-15', '2026-05-15')).toBe('2 years, 2 months')
    expect(formatAge('2026-04-01', '2026-03-01')).toBe('before birth')
  })
})

describe('numbers typed with a unit (BABY-04)', () => {
  it('accepts the field’s units and converts grams', () => {
    expect(parseAmount('6.1 kg', KG_FIELD)).toBe(6.1)
    expect(parseAmount('6,1kg', KG_FIELD)).toBe(6.1)
    expect(parseAmount('6100 g', KG_FIELD)).toBeCloseTo(6.1)
    expect(parseAmount('6.1', KG_FIELD)).toBe(6.1)
    expect(parseAmount('61 cm', CM_FIELD)).toBe(61)
    expect(parseAmount('24 in', CM_FIELD)).toBeCloseTo(60.96)
    expect(parseAmount('24"', IN_FIELD)).toBe(24)
  })

  it('gives undefined for anything else, so the form can say so', () => {
    expect(parseAmount('6.1 lb', KG_FIELD)).toBeUndefined()
    expect(parseAmount('six', KG_FIELD)).toBeUndefined()
    expect(parseAmount('-1 kg', KG_FIELD)).toBeUndefined()
  })
})
