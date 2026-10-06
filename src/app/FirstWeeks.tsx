// The first weeks on the overview: birth weight, the lowest weight compared with it, and when it was
// regained. Shown while the latest measurement is under 3 months. Reference in newborn.ts.

import { Baby } from 'lucide-react'
import { ageInDays } from '../growth/growth'
import { formatWeight, type Units } from '../growth/units'
import { formatPercentChange, newborn, REGAIN_BY_DAYS } from './newborn'
import type { Child, Measurement } from './types'

export function FirstWeeks({ child, measurements, units }: { child: Child; measurements: Measurement[]; units: Units }) {
  const nb = newborn(child, measurements)
  const last = measurements.at(-1)
  if (!nb || !last || ageInDays(child.dateOfBirth, last.date) > 90 || nb.weighings.length === 0) return null
  return (
    <section className="card first-weeks" aria-labelledby="first-weeks-title">
      <h2 id="first-weeks-title" className="section-title">
        <Baby size={18} aria-hidden /> The first weeks
      </h2>
      <dl className="first-weeks-list">
        <div>
          <dt>Birth weight</dt>
          <dd className="num">{formatWeight(nb.birthWeightKg, units)}</dd>
        </div>
        {nb.lowest && (
          <div>
            <dt>Lowest after birth</dt>
            <dd className="num">
              {formatPercentChange(nb.lowest.percentFromBirth)} on day {nb.lowest.ageDays}
            </dd>
          </div>
        )}
        <div>
          <dt>Back to birth weight</dt>
          <dd className="num">{nb.regainedByDay !== undefined ? `by day ${nb.regainedByDay}` : 'not yet'}</dd>
        </div>
      </dl>
      <p className="hint">
        Many babies lose some weight in the first days, and most are back to their birth weight by {REGAIN_BY_DAYS / 7} weeks (NICE guideline NG75). Losing more than 10%, or not being back by {REGAIN_BY_DAYS / 7} weeks, is something to
        mention to your midwife or paediatrician.
      </p>
    </section>
  )
}
