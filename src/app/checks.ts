// Second looks for a new measurement, before it's saved: far off the chart for the age, smaller than
// last time, or a big jump in a short time. They don't judge the baby; they catch typing slips and
// hard-to-take measurements (a wriggling baby's length). Most are warnings that don't block saving.
//
// "Very unlikely" uses WHO's own limits for biologically implausible values, as flagged by WHO's
// anthro software (anthro_zscores): weight-for-age below −6 or above +5, length/height-for-age
// beyond ±6, head circumference-for-age beyond ±5.
// https://worldhealthorganization.github.io/anthro/reference/anthro_zscores.html
//
// Babies born before 37 weeks (BABY-01): until 4 weeks after the due date, a number far below the
// chart is expected, so those checks only ask to compare it with the birth record.

import { ageInDays } from '../growth/growth'
import type { Tables } from '../growth/tables'
import { formatShortDate } from './format'
import { growthFor } from './growthData'
import { beforeTermPlus4Weeks } from './preterm'
import type { Child, Measurement } from './types'

export type Field = 'weight' | 'stature' | 'head'
export type Check = { field: Field; level: 'check' | 'unlikely'; text: string }
export type Candidate = { id?: string; date: string; weightKg?: number; lengthCm?: number; heightCm?: number; headCm?: number }

const FAR_Z = 4
const IMPLAUSIBLE: Record<Field, [number, number]> = { weight: [-6, 5], stature: [-6, 6], head: [-5, 5] }
const SHRINK_CM = 1
const JUMP_Z = 1
const JUMP_DAYS = 28
const WORD: Record<Field, string> = { weight: 'weight', stature: 'length', head: 'head circumference' }

export function measurementChecks(tables: Tables, child: Child, others: Measurement[], c: Candidate): Check[] {
  const out: Check[] = []
  const age = ageInDays(child.dateOfBirth, c.date)
  if (age < 0) return out
  const g = growthFor(tables, child, c)
  const value: Record<Field, number | undefined> = { weight: c.weightKg, stature: c.lengthCm ?? c.heightCm, head: c.headCm }
  const z: Record<Field, number | undefined> = { weight: g.wfa?.z, stature: g.lhfa?.z, head: g.hcfa?.z }

  // Far off the chart, or beyond WHO's implausible limits.
  const early = beforeTermPlus4Weeks(child, c.date)
  for (const f of ['weight', 'stature', 'head'] as Field[]) {
    const zf = z[f]
    if (zf === undefined) continue
    const [lo, hi] = IMPLAUSIBLE[f]
    if (early && zf <= -FAR_Z)
      out.push({ field: f, level: 'check', text: 'Babies born early are smaller at first, so a number far below the chart is expected. Check that it matches the birth record.' })
    else if (zf < lo || zf > hi) out.push({ field: f, level: 'unlikely', text: `This ${WORD[f]} is very unlikely for this age. Check the number and the unit.` })
    else if (Math.abs(zf) >= FAR_Z)
      out.push({
        field: f,
        level: 'check',
        text: `That's far ${zf > 0 ? 'above' : 'below'} the chart for this age. Babies are hard to measure, especially at home, so if you can, measure again. If the number is right, show it to your baby's doctor.`,
      })
  }

  // Compared with the measurement of the same kind just before this date.
  const before = (pick: (m: Measurement) => number | undefined) =>
    others
      .filter((m) => m.id !== c.id && pick(m) !== undefined && m.date <= c.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)
  const prev: Record<Field, Measurement | undefined> = { weight: before((m) => m.weightKg), stature: before((m) => m.lengthCm ?? m.heightCm), head: before((m) => m.headCm) }

  for (const f of ['stature', 'head'] as Field[]) {
    const p = prev[f]
    const v = value[f]
    if (!p || v === undefined) continue
    const pv = f === 'stature' ? growthFor(tables, child, p).statureCm : p.headCm
    const now = f === 'stature' ? g.statureCm : v
    if (pv !== undefined && now !== undefined && pv - now > SHRINK_CM) {
      out.push({
        field: f,
        level: 'check',
        text: `That's ${(pv - now).toFixed(1)} cm less than on ${formatShortDate(p.date)}. ${f === 'stature' ? 'Length' : 'Head circumference'} doesn't go down, so one of the two is probably off; measurements of a baby often differ by about a centimeter.`,
      })
    }
  }

  for (const f of ['weight', 'stature', 'head'] as Field[]) {
    const p = prev[f]
    const zf = z[f]
    if (!p || zf === undefined || out.some((w) => w.field === f)) continue
    const days = ageInDays(p.date, c.date)
    const pz = { weight: growthFor(tables, child, p).wfa?.z, stature: growthFor(tables, child, p).lhfa?.z, head: growthFor(tables, child, p).hcfa?.z }[f]
    if (pz !== undefined && days <= JUMP_DAYS && Math.abs(zf - pz) >= JUMP_Z) {
      out.push({
        field: f,
        level: 'check',
        text: `That's a big change since ${formatShortDate(p.date)}, ${days} days ago. Check the number; if it's right, it's worth mentioning to your baby's doctor.`,
      })
    }
  }
  return out
}
