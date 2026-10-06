// The facts an AI summary is allowed to talk about, all computed here from the stored measurements
// and WHO's tables. The AI explains these numbers; it never works them out. No names or dates of
// birth: ages are in days, and the child is "your baby".

import { ageInDays, computeGrowth, type GrowthResult } from '../growth/growth'
import { percentile } from '../growth/lms'
import type { Indicator, Tables } from '../growth/tables'
import { allIntervals, versusSameLine, type Interval, type Measure } from './gains'
import { LOSS_THRESHOLD_PERCENT, newborn } from './newborn'
import type { Child, Measurement } from './types'

type Score = { z: number; percentile: number }

export type Snapshot = {
  date: string
  ageDays: number
  weightKg?: number
  lengthOrHeightCm?: number
  measuredStanding?: boolean
  headCm?: number
  measuredAt?: 'clinic' | 'home' | 'other'
  scores: Partial<Record<Indicator, Score>>
}

export type Flag = { indicator: Indicator; reason: string }

// One interval between consecutive measurements of a kind, as the AI sees it: ages, not dates of
// birth. Weight in grams per week, length and head in cm per month.
export type GainFact = {
  fromAgeDays: number
  toAgeDays: number
  days: number
  perWeekGrams?: number
  perMonthCm?: number
  sameLinePerWeekGrams?: number
  sameLinePerMonthCm?: number
  comparedWithSameLine?: 'about the same' | 'more' | 'less'
  tooShortToCompare?: true
}

export type Facts = {
  baby: { sex: 'girl' | 'boy'; ageDaysToday: number; bornAtWeeks?: number }
  latest: Snapshot
  previous?: Snapshot
  change?: {
    days: number
    weightGramsPerWeek?: number
    lengthOrHeightCmChange?: number
    headCmChange?: number
    percentileMoves: { indicator: Indicator; fromPercentile: number; toPercentile: number; zChange: number }[]
  }
  // The last few intervals per kind, oldest first, with the gain that would have kept the same
  // percentile line.
  gains: Partial<Record<Measure, GainFact[]>>
  // The first weeks, while the latest measurement is under 3 months: weight change from birth weight.
  newborn?: { birthWeightKg: number; lowestPercentFromBirth?: number; lowestAtAgeDays?: number; backToBirthWeightByAgeDays?: number }
  // Set by the code, never the AI: things worth mentioning to the paediatrician. A measurement
  // outside the 3rd–97th band is flagged when it gets there; while it stays there, it's listed in
  // stillOutside instead, as context.
  worthMentioning: Flag[]
  stillOutside: { indicator: Indicator; side: 'above the 97th' | 'below the 3rd' }[]
  indicatorNames: Partial<Record<Indicator, string>>
}

const NAMES: Record<Indicator, string> = {
  wfa: 'weight for age',
  lhfa: 'length/height for age',
  hcfa: 'head circumference for age',
  wfl: 'weight for length',
  wfh: 'weight for height',
  bfa: 'BMI for age',
}

// Neutral thresholds for "worth mentioning to your paediatrician". They aren't diagnoses: they mark
// numbers a parent may want to ask about. A z-score change of 1 is roughly crossing two of the WHO
// chart's percentile lines (3rd, 15th, 50th, 85th, 97th).
const BIG_MOVE_Z = 1
const OUTER_Z = 1.881 // outside the 3rd–97th percentile band

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

function snapshot(tables: Tables, child: Child, m: Measurement): Snapshot {
  const ageDays = ageInDays(child.dateOfBirth, m.date)
  const g: GrowthResult = computeGrowth(tables, {
    ageDays,
    sex: child.sex,
    weightKg: m.weightKg,
    lengthCm: m.lengthCm,
    heightCm: m.heightCm,
    headCm: m.headCm,
  })
  const scores: Snapshot['scores'] = {}
  for (const key of ['wfa', 'lhfa', 'hcfa', 'wfl', 'wfh', 'bfa'] as Indicator[]) {
    const r = g[key]
    if (r) scores[key] = { z: r.z, percentile: round(percentile(r.z)) }
  }
  return {
    date: m.date,
    ageDays,
    weightKg: m.weightKg,
    lengthOrHeightCm: m.lengthCm ?? m.heightCm,
    measuredStanding: m.lengthCm === undefined && m.heightCm !== undefined ? true : m.lengthCm !== undefined ? false : undefined,
    headCm: m.headCm,
    measuredAt: m.place,
    scores,
  }
}

export function buildFacts(tables: Tables, child: Child, measurements: Measurement[], today: string): Facts | null {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  if (!sorted.length) return null
  const latest = snapshot(tables, child, sorted.at(-1)!)
  const previous = sorted.length > 1 ? snapshot(tables, child, sorted.at(-2)!) : undefined
  const facts: Facts = {
    baby: {
      sex: child.sex === 'female' ? 'girl' : 'boy',
      ageDaysToday: ageInDays(child.dateOfBirth, today),
      bornAtWeeks: child.gestationalAge?.weeks,
    },
    latest,
    previous,
    gains: gainFacts(allIntervals(tables, child, sorted), child),
    worthMentioning: [],
    stillOutside: [],
    indicatorNames: {},
  }

  for (const [key, s] of Object.entries(latest.scores) as [Indicator, Score][]) {
    facts.indicatorNames[key] = NAMES[key]
    if (Math.abs(s.z) > OUTER_Z) {
      const side = s.z < 0 ? 'below the 3rd' : 'above the 97th'
      const before = previous?.scores[key]
      const wasOutsideSameSide = !!before && Math.abs(before.z) > OUTER_Z && Math.sign(before.z) === Math.sign(s.z)
      if (wasOutsideSameSide) facts.stillOutside.push({ indicator: key, side })
      else facts.worthMentioning.push({ indicator: key, reason: `${NAMES[key]} is ${side} percentile` })
    }
  }

  if (previous) {
    const days = latest.ageDays - previous.ageDays
    const moves: NonNullable<Facts['change']>['percentileMoves'] = []
    for (const [key, s] of Object.entries(latest.scores) as [Indicator, Score][]) {
      const before = previous.scores[key]
      if (!before) continue
      const zChange = round(s.z - before.z, 2)
      moves.push({ indicator: key, fromPercentile: before.percentile, toPercentile: s.percentile, zChange })
      if (Math.abs(zChange) >= BIG_MOVE_Z) {
        facts.worthMentioning.push({ indicator: key, reason: `${NAMES[key]} moved from about the ${before.percentile} to the ${s.percentile} percentile since the previous measurement` })
      }
    }
    const diff = (a?: number, b?: number) => (a !== undefined && b !== undefined ? a - b : undefined)
    const weightDiff = diff(latest.weightKg, previous.weightKg)
    facts.change = {
      days,
      weightGramsPerWeek: weightDiff !== undefined && days > 0 ? Math.round(((weightDiff * 1000) / days) * 7) : undefined,
      lengthOrHeightCmChange: round(diff(latest.lengthOrHeightCm, previous.lengthOrHeightCm) ?? NaN) || undefined,
      headCmChange: round(diff(latest.headCm, previous.headCm) ?? NaN) || undefined,
      percentileMoves: moves,
    }
    // Losing weight after the first two weeks is worth a mention (the first days are covered below).
    if (weightDiff !== undefined && weightDiff < 0 && latest.ageDays > 14) {
      facts.worthMentioning.push({ indicator: 'wfa', reason: 'weight went down since the previous measurement' })
    }
  }
  // The first weeks (NICE NG75, see newborn.ts).
  const nb = newborn(child, sorted)
  if (nb && latest.ageDays <= 90) {
    facts.newborn = {
      birthWeightKg: nb.birthWeightKg,
      lowestPercentFromBirth: nb.lowest ? round(nb.lowest.percentFromBirth) : undefined,
      lowestAtAgeDays: nb.lowest?.ageDays,
      backToBirthWeightByAgeDays: nb.regainedByDay,
    }
    if (latest.ageDays <= 42) {
      if (nb.lostMoreThan10) {
        facts.worthMentioning.push({ indicator: 'wfa', reason: `weight was more than ${LOSS_THRESHOLD_PERCENT}% below birth weight in the first two weeks` })
      }
      if (nb.notRegainedBy3Weeks) facts.worthMentioning.push({ indicator: 'wfa', reason: 'weight was not back to birth weight by 3 weeks of age' })
    }
  }
  return facts
}

const GAINS_SENT = 6

function gainFacts(series: Record<Measure, Interval[]>, child: Child): Facts['gains'] {
  const out: Facts['gains'] = {}
  for (const measure of ['weight', 'length', 'head'] as Measure[]) {
    const list = series[measure].slice(-GAINS_SENT)
    if (!list.length) continue
    out[measure] = list.map((i) => {
      const weight = measure === 'weight'
      const f: GainFact = {
        fromAgeDays: ageInDays(child.dateOfBirth, i.from.date),
        toAgeDays: ageInDays(child.dateOfBirth, i.to.date),
        days: i.days,
      }
      if (weight) f.perWeekGrams = Math.round(i.rate * 1000)
      else f.perMonthCm = round(i.rate, 1)
      if (i.short) f.tooShortToCompare = true
      else if (i.sameLine !== undefined) {
        if (weight) f.sameLinePerWeekGrams = Math.round(i.sameLine * 1000)
        else f.sameLinePerMonthCm = round(i.sameLine, 1)
        f.comparedWithSameLine = versusSameLine(i)
      }
      return f
    })
  }
  return out
}

// A digest of the facts, so the app can tell when a saved summary is out of date.
export async function factsDigest(facts: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(facts))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...hash.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
