// Growth indicators for one measurement: age, z-scores and percentiles, computed from WHO's tables.

import { adjustedZ, rawZ, round2 } from './lms'
import { lmsAt, type Indicator, type Sex, type Tables } from './tables'

// WHO switches from lying length to standing height at 2 years (731 days).
export const HEIGHT_FROM_DAY = 731
const LENGTH_HEIGHT_DIFFERENCE_CM = 0.7

export type MeasurementInput = {
  ageDays: number
  sex: Sex
  weightKg?: number
  lengthCm?: number // lying
  heightCm?: number // standing
  headCm?: number
}

export type IndicatorResult = { indicator: Indicator; value: number; z: number }

export type GrowthResult = Partial<Record<Indicator, IndicatorResult>> & {
  // The length or height used for the charts, after WHO's 0.7 cm adjustment if one applied.
  statureCm?: number
}

// Whole days between two ISO dates (YYYY-MM-DD), independent of time zones.
export function ageInDays(dateOfBirth: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dateOfBirth}T00:00:00Z`)) / 86_400_000)
}

// Under 2 years WHO expects lying length; from 2, standing height. A measurement of the other kind
// is adjusted by 0.7 cm, as WHO's anthro does.
export function adjustedStature(ageDays: number, lengthCm?: number, heightCm?: number): number | undefined {
  if (ageDays < HEIGHT_FROM_DAY) {
    if (lengthCm !== undefined) return lengthCm
    if (heightCm !== undefined) return heightCm + LENGTH_HEIGHT_DIFFERENCE_CM
  } else {
    if (heightCm !== undefined) return heightCm
    if (lengthCm !== undefined) return lengthCm - LENGTH_HEIGHT_DIFFERENCE_CM
  }
  return undefined
}

const WEIGHT_BASED: ReadonlySet<Indicator> = new Set(['wfa', 'wfl', 'wfh', 'bfa'])

function score(tables: Tables, indicator: Indicator, sex: Sex, x: number, y: number): IndicatorResult | undefined {
  const lms = lmsAt(tables[indicator], sex, x)
  if (!lms || !(y > 0)) return undefined
  const z = WEIGHT_BASED.has(indicator) ? adjustedZ(y, lms) : rawZ(y, lms)
  return { indicator, value: y, z: round2(z) }
}

export function computeGrowth(tables: Tables, m: MeasurementInput): GrowthResult {
  const result: GrowthResult = {}
  if (m.ageDays < 0) return result
  const stature = adjustedStature(m.ageDays, m.lengthCm, m.heightCm)
  if (stature !== undefined) result.statureCm = stature

  if (m.weightKg !== undefined) result.wfa = score(tables, 'wfa', m.sex, m.ageDays, m.weightKg)
  if (stature !== undefined) result.lhfa = score(tables, 'lhfa', m.sex, m.ageDays, stature)
  if (m.headCm !== undefined) result.hcfa = score(tables, 'hcfa', m.sex, m.ageDays, m.headCm)
  if (m.weightKg !== undefined && stature !== undefined) {
    const forStature = m.ageDays < HEIGHT_FROM_DAY ? 'wfl' : 'wfh'
    result[forStature] = score(tables, forStature, m.sex, stature, m.weightKg)
    result.bfa = score(tables, 'bfa', m.sex, m.ageDays, m.weightKg / (stature / 100) ** 2)
  }
  for (const key of Object.keys(result) as (keyof GrowthResult)[]) {
    if (result[key] === undefined) delete result[key]
  }
  return result
}
