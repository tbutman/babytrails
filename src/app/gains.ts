// Gain over time: the change between each pair of consecutive measurements of one kind, and the
// gain that would have kept the baby on the same WHO percentile line over the same days. All
// computed here from the stored values and WHO's tables; nothing comes from the AI.

import { ageInDays, computeGrowth } from '../growth/growth'
import { valueAtAdjustedZ, valueAtZ } from '../growth/lms'
import { lmsAt, type Indicator, type Tables } from '../growth/tables'
import { formatMonthlyGain, formatWeeklyGain, type Units } from '../growth/units'
import type { Child, Measurement } from './types'

export type Measure = 'weight' | 'length' | 'head'

export type Interval = {
  measure: Measure
  from: Measurement
  to: Measurement
  days: number
  /** kg for weight, cm for length and head, as measured (length after WHO's 0.7 cm adjustment). */
  change: number
  /** The change per week (weight, kg) or per month (length and head, cm). */
  rate: number
  /** The rate that would have kept the same z-score over the same days, in the same unit. */
  sameLine?: number
  fromZ?: number
  toZ?: number
  /** Too few days apart for the change to say much: scales and measurers differ by more. */
  short: boolean
}

export const DAYS_PER_MONTH = 30.4375
const MIN_DAYS: Record<Measure, number> = { weight: 7, length: 21, head: 21 }
const INDICATOR: Record<Measure, Indicator> = { weight: 'wfa', length: 'lhfa', head: 'hcfa' }

type Point = { m: Measurement; ageDays: number; value: number; z?: number }

function points(tables: Tables, child: Child, measurements: Measurement[], measure: Measure): Point[] {
  const out: Point[] = []
  for (const m of [...measurements].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    const ageDays = ageInDays(child.dateOfBirth, m.date)
    const g = computeGrowth(tables, { ageDays, sex: child.sex, weightKg: m.weightKg, lengthCm: m.lengthCm, heightCm: m.heightCm, headCm: m.headCm })
    const value = measure === 'weight' ? m.weightKg : measure === 'length' ? g.statureCm : m.headCm
    if (value === undefined) continue
    out.push({ m, ageDays, value, z: g[INDICATOR[measure]]?.z })
  }
  return out
}

/** The value at a z-score and age for one measure, by WHO's rules (adjusted beyond ±3 SD for weight). */
function valueAt(tables: Tables, child: Child, measure: Measure, ageDays: number, z: number): number | undefined {
  const lms = lmsAt(tables[INDICATOR[measure]], child.sex, ageDays)
  if (!lms) return undefined
  return measure === 'weight' ? valueAtAdjustedZ(lms, z) : valueAtZ(lms, z)
}

export function intervals(tables: Tables, child: Child, measurements: Measurement[], measure: Measure): Interval[] {
  const pts = points(tables, child, measurements, measure)
  const out: Interval[] = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const days = b.ageDays - a.ageDays
    if (days <= 0) continue
    const per = measure === 'weight' ? 7 : DAYS_PER_MONTH
    const change = b.value - a.value
    let sameLine: number | undefined
    if (a.z !== undefined) {
      const target = valueAt(tables, child, measure, b.ageDays, a.z)
      if (target !== undefined) sameLine = ((target - a.value) / days) * per
    }
    out.push({ measure, from: a.m, to: b.m, days, change, rate: (change / days) * per, sameLine, fromZ: a.z, toZ: b.z, short: days < MIN_DAYS[measure] })
  }
  return out
}

/** Every measure's intervals at once. */
export function allIntervals(tables: Tables, child: Child, measurements: Measurement[]): Record<Measure, Interval[]> {
  return {
    weight: intervals(tables, child, measurements, 'weight'),
    length: intervals(tables, child, measurements, 'length'),
    head: intervals(tables, child, measurements, 'head'),
  }
}

/** How a rate compares with the same-line rate, in words the app and the AI share. */
export function versusSameLine(i: Interval): 'about the same' | 'more' | 'less' | undefined {
  if (i.sameLine === undefined) return undefined
  // Within 10% (or a tiny absolute difference) reads as "about the same".
  const tolerance = Math.max(Math.abs(i.sameLine) * 0.1, i.measure === 'weight' ? 0.005 : 0.05)
  if (Math.abs(i.rate - i.sameLine) <= tolerance) return 'about the same'
  return i.rate > i.sameLine ? 'more' : 'less'
}

export function formatRate(i: Pick<Interval, 'measure' | 'rate'>, rate: number, units: Units): string {
  return i.measure === 'weight' ? formatWeeklyGain(rate, units) : formatMonthlyGain(rate, units)
}

export function sameLineSentence(i: Interval, units: Units): string | undefined {
  const v = versusSameLine(i)
  if (!v || i.sameLine === undefined) return undefined
  const line = `Staying on the same percentile line would have meant about ${formatRate(i, i.sameLine, units)}`
  return v === 'about the same' ? `${line}: about the same.` : `${line}, so this was ${v}.`
}
