import { describe, expect, it } from 'vitest'
import { toProposedRows } from '../../src/app/prompts/extraction'

const item = (over: Record<string, unknown>) => ({
  date: '15/09/2026', weight: 7.1, weight_unit: 'kg', length: 64.3, length_unit: 'cm', length_kind: 'lying',
  head: 41.6, head_unit: 'cm', source_text: '15/09/2026 7,10 kg 64,3 cm 41,6 cm', confidence: 'high', page: 1, ...over,
})

describe('extraction output', () => {
  it('converts units in code and keeps the printed date', () => {
    const [row] = toProposedRows({ measurements: [item({ weight: 7100, weight_unit: 'g', length: 643, length_unit: 'mm' })] })
    expect(row.values).toEqual({ date: '15/09/2026', weightKg: 7.1, statureCm: 64.3, standing: 'no', headCm: 41.6 })
    expect(row.confidence).toBe('high')
    expect(row.page).toBe(1)
  })

  it('drops malformed items and items with no values', () => {
    const rows = toProposedRows({ measurements: [null, { foo: 1 }, item({ weight: null, length: null, head: null }), item({ weight: -3, length: null, head: null }), item({})] })
    expect(rows).toHaveLength(1)
  })

  it('treats unknown confidence as low, and units it does not know as missing', () => {
    const [row] = toProposedRows({ measurements: [item({ confidence: 'very sure', weight_unit: 'stone' })] })
    expect(row.confidence).toBe('low')
    expect(row.values.weightKg).toBeUndefined()
  })

  it('rejects answers without a list', () => {
    expect(() => toProposedRows({ results: [] })).toThrow()
    expect(() => toProposedRows('<script>')).toThrow()
  })
})
