// WHO's weight velocity standards: how much weight babies gain over 1-month intervals (birth to 12
// months) and 2-month intervals (birth to 24 months). Each interval has L, M and S for the increment
// in grams plus a Delta, added before the transformation so negative increments can be scored.
// WHO Multicentre Growth Reference Study Group. WHO Child Growth Standards: Growth velocity based on
// weight, length and head circumference. Methods and development. Geneva: WHO; 2009.
//
// An increment is only compared when both measurements were taken within 3 days of the interval's
// start and end ages, the tolerance reported for how the standards were built. Measurements further
// apart than that aren't scaled to fit: the app says the reference doesn't apply.

import { rawZ } from './lms'
import type { Sex } from './tables'

export type VelocityRow = { from: number; to: number; L: number; M: number; S: number; delta: number }
export type VelocityTables = { weight1: Record<Sex, VelocityRow[]>; weight2: Record<Sex, VelocityRow[]> }
export type Increment = { months: 1 | 2; from: number; to: number; z: number }

export const VELOCITY_TOLERANCE_DAYS = 3

let loading: Promise<VelocityTables> | undefined
export function loadVelocity(): Promise<VelocityTables> {
  loading ??= import('./data/velocity.json').then((m) => m.default as VelocityTables)
  return loading
}

/** The z-score of a weight gain against WHO's increments, if the two ages match an interval. */
export function weightIncrement(v: VelocityTables, sex: Sex, fromAgeDays: number, toAgeDays: number, gainGrams: number): Increment | undefined {
  for (const [months, rows] of [[1, v.weight1[sex]], [2, v.weight2[sex]]] as const) {
    const row = rows.find((r) => Math.abs(fromAgeDays - r.from) <= VELOCITY_TOLERANCE_DAYS && Math.abs(toAgeDays - r.to) <= VELOCITY_TOLERANCE_DAYS)
    if (row) return { months, from: row.from, to: row.to, z: Math.round(rawZ(gainGrams + row.delta, row) * 100) / 100 || 0 }
  }
  return undefined
}

/** "5–6 months", "birth–4 weeks", "4 weeks–2 months": an interval's label. */
export function incrementLabel(i: Pick<Increment, 'from' | 'to'>): string {
  const part = (d: number) => (d === 0 ? 'birth' : d % 7 === 0 && d <= 28 ? `${d / 7} weeks` : `${Math.round(d / 30.4375)} months`)
  const a = part(i.from)
  const b = part(i.to)
  return a.endsWith('months') && b.endsWith('months') ? `${a.replace(' months', '')}–${b}` : `${a}–${b}`
}
