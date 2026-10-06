import { describe, expect, it } from 'vitest'
import { valueAtZ } from '../../src/growth/lms'
import { incrementLabel, loadVelocity, weightIncrement } from '../../src/growth/velocity'

const v = await loadVelocity()

describe("WHO's weight velocity standards", () => {
  it("reproduces WHO's published values: boys, 1-month increments, birth to 4 weeks (g)", () => {
    const row = v.weight1.male[0]
    // From WHO's table: −3 SD −160, −2 SD 321, median 1023, +2 SD 1608, +3 SD 1876.
    const at = (k: number) => Math.round(valueAtZ(row, k) - row.delta)
    expect([at(-3), at(-2), at(0), at(2), at(3)]).toEqual([-160, 321, 1023, 1608, 1876])
  })

  it('covers 1-month intervals to 12 months and 2-month intervals to 24 months, for girls and boys', () => {
    for (const sex of ['male', 'female'] as const) {
      expect(v.weight1[sex].map((r) => incrementLabel(r))).toEqual(['birth–4 weeks', '4 weeks–2 months', ...Array.from({ length: 10 }, (_, i) => `${i + 2}–${i + 3} months`)])
      expect(v.weight2[sex]).toHaveLength(23)
      expect(incrementLabel(v.weight2[sex][22])).toBe('22–24 months')
    }
  })

  it('scores a gain only when both measurements are within 3 days of an interval', () => {
    // Boys, 5–6 months (days 152.2 to 182.6): WHO's median is 422 g.
    expect(weightIncrement(v, 'male', 152, 183, 422)).toMatchObject({ months: 1, from: 152.1875, to: 182.625 })
    expect(weightIncrement(v, 'male', 152, 183, 422)!.z).toBeCloseTo(0, 2)
    expect(weightIncrement(v, 'male', 150, 185, 422)?.months).toBe(1)
    expect(weightIncrement(v, 'male', 140, 183, 422)).toBeUndefined()
    // Two months apart: the 2-month table (4–6 months).
    expect(weightIncrement(v, 'male', 122, 183, 900)?.months).toBe(2)
  })

  it('scores weight losses too', () => {
    expect(weightIncrement(v, 'female', 0, 28, -100)!.z).toBeLessThan(-3)
  })
})
