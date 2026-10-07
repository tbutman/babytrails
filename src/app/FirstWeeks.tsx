// The first weeks on the overview: birth weight, the lowest weight compared with it, and when it was
// regained. Shown while the latest measurement is under 3 months. While the latest is within 6
// weeks, NICE's two flags are spelled out (BABY-02). Reference in newborn.ts.

import { Baby, CircleAlert } from 'lucide-react'
import { ageInDays } from '../growth/growth'
import { formatWeight, type Units } from '../growth/units'
import { formatPercentChange, LOSS_THRESHOLD_PERCENT, newborn, NICE_URL, REGAIN_BY_DAYS } from './newborn'
import type { Child, Measurement } from './types'

const FLAGS_UNTIL_DAYS = 42

export function FirstWeeks({ child, measurements, units }: { child: Child; measurements: Measurement[]; units: Units }) {
  const nb = newborn(child, measurements)
  const last = measurements.at(-1)
  if (!nb || !last || ageInDays(child.dateOfBirth, last.date) > 90 || nb.weighings.length === 0) return null
  const recent = ageInDays(child.dateOfBirth, last.date) <= FLAGS_UNTIL_DAYS
  const flags: string[] = []
  if (recent && nb.lostMoreThan10 && nb.earlyLowest) {
    flags.push(
      `The lowest weight, on day ${nb.earlyLowest.ageDays}, was ${Math.abs(nb.earlyLowest.percentFromBirth).toFixed(1)}% below birth weight. NICE's guideline says a loss of more than ${LOSS_THRESHOLD_PERCENT}% should be checked by a health professional, so let your midwife or your baby's doctor know soon, if they don't know already.`,
    )
  }
  if (recent && nb.notRegainedAt) {
    flags.push(
      `At the weighing on day ${nb.notRegainedAt.ageDays}, your baby wasn't back to birth weight yet. Most babies are by ${REGAIN_BY_DAYS / 7} weeks; mention it to your midwife or your baby's doctor.`,
    )
  }
  const regained =
    nb.regainedByDay === undefined
      ? 'not yet'
      : nb.gapBeforeRegain
        ? `at the day ${nb.regainedByDay} weighing (no weighing between day ${nb.gapBeforeRegain.fromDay} and day ${nb.gapBeforeRegain.toDay})`
        : `by day ${nb.regainedByDay}`
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
          <dd className="num">{regained}</dd>
        </div>
      </dl>
      {flags.map((f) => (
        <div key={f} className="mention">
          <CircleAlert size={18} aria-hidden />
          <p>{f}</p>
        </div>
      ))}
      <p className="hint">
        Many babies lose some weight in the first days, and most are back to their birth weight by {REGAIN_BY_DAYS / 7} weeks (
        <a href={NICE_URL} target="_blank" rel="noreferrer">
          NICE guideline NG75
        </a>
        ). Losing more than {LOSS_THRESHOLD_PERCENT}%, or not being back by {REGAIN_BY_DAYS / 7} weeks, is something to mention to your midwife or your
        baby's doctor.
      </p>
    </section>
  )
}

