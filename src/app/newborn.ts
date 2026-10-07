// The first weeks: weight change from birth weight, and when birth weight was regained. Computed by
// the code from the stored weights.
//
// Reference: NICE guideline NG75, "Faltering growth: recognition and management of faltering growth
// in children" (2017), recommendations 1.1.1–1.1.4: it's common for babies to lose some weight in
// the early days; most are back to birth weight by 3 weeks; losing more than 10% of birth weight in
// the early days, or not being back to birth weight by 3 weeks, should prompt a clinical
// assessment. https://www.nice.org.uk/guidance/ng75/chapter/Recommendations

import { ageInDays } from '../growth/growth'
import type { Child, Measurement } from './types'

export const NICE_URL = 'https://www.nice.org.uk/guidance/ng75/chapter/Recommendations'
export const NEWBORN_DAYS = 28
export const LOSS_THRESHOLD_PERCENT = 10
export const LOSS_WINDOW_DAYS = 14
export const REGAIN_BY_DAYS = 21

export type NewbornWeighing = { measurement: Measurement; ageDays: number; percentFromBirth: number }

export type Newborn = {
  birthWeightKg: number
  /** Weighings after birth, up to 28 days. */
  weighings: NewbornWeighing[]
  lowest?: NewbornWeighing
  /** The age of the first weighing at or above birth weight, if there was one. */
  regainedByDay?: number
  /** A weighing at 3 weeks or later, with none at or above birth weight before it. */
  notRegainedBy3Weeks: boolean
  /** The lowest weight in the first two weeks was more than 10% below birth weight. */
  lostMoreThan10: boolean
  /** The lowest weighing in the first two weeks, when it was below birth weight. */
  earlyLowest?: NewbornWeighing
  /** The first weighing at 3 weeks or later, while not back to birth weight. */
  notRegainedAt?: NewbornWeighing
  /** The weighing before the regain, when it was more than a week before it (BABY-02). */
  gapBeforeRegain?: { fromDay: number; toDay: number }
}

/** The birth measurement: one marked as birth, or else one on the date of birth with a weight. */
export function birthMeasurement(child: Child, measurements: Measurement[]): Measurement | undefined {
  const withWeight = measurements.filter((m) => m.weightKg !== undefined)
  return withWeight.find((m) => m.birth) ?? withWeight.find((m) => m.date === child.dateOfBirth)
}

export const percentFrom = (birthKg: number, kg: number) => ((kg - birthKg) / birthKg) * 100

export function newborn(child: Child, measurements: Measurement[]): Newborn | null {
  const birth = birthMeasurement(child, measurements)
  if (!birth) return null
  const birthKg = birth.weightKg!
  const later = measurements
    .filter((m) => m !== birth && m.weightKg !== undefined)
    .map((m) => ({ measurement: m, ageDays: ageInDays(child.dateOfBirth, m.date), percentFromBirth: percentFrom(birthKg, m.weightKg!) }))
    .filter((w) => w.ageDays > 0)
    .sort((a, b) => a.ageDays - b.ageDays)
  const weighings = later.filter((w) => w.ageDays <= NEWBORN_DAYS)
  const lowest = weighings.reduce<NewbornWeighing | undefined>((lo, w) => (!lo || w.percentFromBirth < lo.percentFromBirth ? w : lo), undefined)
  const regained = later.find((w) => w.percentFromBirth >= 0)
  const firstAt3Weeks = later.find((w) => w.ageDays >= REGAIN_BY_DAYS)
  const early = weighings.filter((w) => w.ageDays <= LOSS_WINDOW_DAYS).reduce<NewbornWeighing | undefined>((lo, w) => (!lo || w.percentFromBirth < lo.percentFromBirth ? w : lo), undefined)
  const earlyLowest = Math.min(0, early?.percentFromBirth ?? 0)
  const notRegained = !!firstAt3Weeks && (!regained || regained.ageDays > firstAt3Weeks.ageDays)
  const beforeRegain = regained ? later.filter((w) => w.ageDays < regained.ageDays).at(-1) : undefined
  return {
    birthWeightKg: birthKg,
    weighings,
    lowest: lowest && lowest.percentFromBirth < 0 ? lowest : undefined,
    regainedByDay: regained?.ageDays,
    notRegainedBy3Weeks: notRegained,
    lostMoreThan10: earlyLowest < -LOSS_THRESHOLD_PERCENT,
    earlyLowest: early && early.percentFromBirth < 0 ? early : undefined,
    notRegainedAt: notRegained ? firstAt3Weeks : undefined,
    gapBeforeRegain:
      regained && beforeRegain && regained.ageDays - beforeRegain.ageDays > 7 ? { fromDay: beforeRegain.ageDays, toDay: regained.ageDays } : undefined,
  }
}

/** "−6.5%" or "+2.0%", one decimal. */
export function formatPercentChange(p: number): string {
  return `${p < 0 ? '−' : '+'}${Math.abs(p).toFixed(1)}%`
}

/**
 * In the first weeks the WHO medians rise from day 1, so the "same line" comparison reads the usual
 * early loss as "less" (BABY-18). Until day 21, or until birth weight is back, compare with birth
 * weight instead.
 */
export function firstWeeksNote(child: Child, measurements: Measurement[]): boolean {
  const nb = newborn(child, measurements)
  const last = measurements.filter((m) => m.weightKg !== undefined).at(-1)
  if (!nb || !last) return false
  const day = ageInDays(child.dateOfBirth, last.date)
  return day <= REGAIN_BY_DAYS && (nb.regainedByDay === undefined || nb.regainedByDay >= day)
}
