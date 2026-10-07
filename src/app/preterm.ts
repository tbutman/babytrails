// Babies born early (BABY-01, a stopgap until charts by corrected age): BabyTrails' percentiles use
// age from the date of birth, so a baby born early sits low on the WHO charts at first. The app says
// so where percentiles are shown, softens the second looks around birth, and tells the AI.

import { ageInDays } from '../growth/growth'
import type { Child } from './types'

/** Before 37 weeks of pregnancy. */
export const PRETERM_WEEKS = 37
/** Doctors usually correct the age until about 2 years. */
const NOTICE_UNTIL_DAYS = 731

export const bornEarly = (child: Child) => child.gestationalAge !== undefined && child.gestationalAge.weeks < PRETERM_WEEKS

/** "30+2 weeks", or "30 weeks". */
export function bornAt(child: Child): string | undefined {
  const g = child.gestationalAge
  if (!g) return undefined
  return g.days ? `${g.weeks}+${g.days} weeks` : `${g.weeks} weeks`
}

/** Until 4 weeks after the due date (40 weeks): second looks expect small numbers. */
export function beforeTermPlus4Weeks(child: Child, date: string): boolean {
  const g = child.gestationalAge
  if (!g || !bornEarly(child)) return false
  const untilDays = (40 * 7 - (g.weeks * 7 + g.days)) + 28
  return ageInDays(child.dateOfBirth, date) < untilDays
}

/** The calm note over percentiles for a baby born early, while it matters (to about 2 years). */
export function pretermNotice(child: Child, on: string): string | undefined {
  if (!bornEarly(child) || ageInDays(child.dateOfBirth, on) >= NOTICE_UNTIL_DAYS) return undefined
  return `Born at ${bornAt(child)}. These percentiles use age from the date of birth. For babies born early, doctors usually use corrected age (counted from the due date) until about 2 years, so your baby's doctor may see higher percentiles than these.`
}
