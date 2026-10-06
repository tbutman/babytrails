// The facts "Ask about the numbers" sends, and checks answers against: the summary facts without
// dates (ages in days only), every measurement that counts with its percentiles, and the reference
// points an answer may need (the chart's percentile lines, NICE's newborn thresholds). No name, no
// date of birth, no dates.

import { ageInDays } from '../growth/growth'
import { percentile } from '../growth/lms'
import type { Tables } from '../growth/tables'
import { buildFacts, type Facts } from './facts'
import { growthFor } from './growthData'
import { LOSS_THRESHOLD_PERCENT, REGAIN_BY_DAYS } from './newborn'
import type { Child, Measurement } from './types'

type Undated<T> = Omit<T, 'date'>
export type AskFacts = Omit<Facts, 'latest' | 'previous'> & {
  latest: Undated<Facts['latest']>
  previous?: Undated<NonNullable<Facts['previous']>>
  history: {
    ageDays: number
    weightKg?: number
    lengthOrHeightCm?: number
    headCm?: number
    measuredAt?: string
    percentiles: { weightForAge?: number; lengthForAge?: number; headForAge?: number; weightForLength?: number }
  }[]
  references: { whoChartPercentileLines: number[]; newbornLossPercent?: number; backToBirthWeightByDays?: number }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const p = (z: number | undefined) => (z === undefined ? undefined : round1(percentile(z)))

export function askFacts(tables: Tables, child: Child, measurements: Measurement[], today: string): AskFacts | null {
  const facts = buildFacts(tables, child, measurements, today)
  if (!facts) return null
  const { date: _l, ...latest } = facts.latest
  const previous = facts.previous ? (({ date: _p, ...rest }) => rest)(facts.previous) : undefined
  const history = [...measurements]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      const g = growthFor(tables, child, m)
      return {
        ageDays: ageInDays(child.dateOfBirth, m.date),
        weightKg: m.weightKg,
        lengthOrHeightCm: m.lengthCm ?? m.heightCm,
        headCm: m.headCm,
        measuredAt: m.place,
        percentiles: { weightForAge: p(g.wfa?.z), lengthForAge: p(g.lhfa?.z), headForAge: p(g.hcfa?.z), weightForLength: p((g.wfl ?? g.wfh)?.z) },
      }
    })
  return {
    ...facts,
    latest,
    previous,
    history,
    references: {
      whoChartPercentileLines: [3, 15, 50, 85, 97],
      ...(facts.newborn ? { newbornLossPercent: LOSS_THRESHOLD_PERCENT, backToBirthWeightByDays: REGAIN_BY_DAYS } : {}),
    },
  }
}
