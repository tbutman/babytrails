// The facts an AI summary is allowed to talk about, all computed here from the stored measurements
// and WHO's tables. The AI explains these numbers; it never works them out. No names or dates of
// birth: ages are in days, and the child is "your baby".

import { ageInDays, computeGrowth, type GrowthResult } from '../growth/growth'
import { percentile } from '../growth/lms'
import type { Indicator, Tables } from '../growth/tables'
import type { Child, Measurement } from './types'

type Score = { z: number; percentile: number }

export type Snapshot = {
  date: string
  ageDays: number
  weightKg?: number
  lengthOrHeightCm?: number
  measuredStanding?: boolean
  headCm?: number
  scores: Partial<Record<Indicator, Score>>
}

export type Flag = { indicator: Indicator; reason: string }

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
  // Set by the code, never the AI: things worth mentioning to the paediatrician.
  worthMentioning: Flag[]
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
    worthMentioning: [],
    indicatorNames: {},
  }

  for (const [key, s] of Object.entries(latest.scores) as [Indicator, Score][]) {
    facts.indicatorNames[key] = NAMES[key]
    if (Math.abs(s.z) > OUTER_Z) {
      facts.worthMentioning.push({ indicator: key, reason: `${NAMES[key]} is ${s.z < 0 ? 'below the 3rd' : 'above the 97th'} percentile` })
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
    // Losing weight after the first two weeks is worth a mention.
    if (weightDiff !== undefined && weightDiff < 0 && latest.ageDays > 14) {
      facts.worthMentioning.push({ indicator: 'wfa', reason: 'weight went down since the previous measurement' })
    }
  }
  return facts
}

// A digest of the facts, so the app can tell when a saved summary is out of date.
export async function factsDigest(facts: Facts): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(facts))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...hash.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
