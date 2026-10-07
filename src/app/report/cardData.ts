// The report card's content, worked out by the code from the saved measurements: the latest
// numbers, the charts to draw, gain over time, a short history and a few highlights written from
// templates. No AI is needed; an AI summary is added only if the parent chooses, and labelled.

import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { formatPercentile } from '../../growth/lms'
import type { Indicator, Tables } from '../../growth/tables'
import { formatLength, formatWeight, KG_PER_LB, type Units } from '../../growth/units'
import { formatAge, formatDate, formatShortDate } from '../format'
import { allIntervals, formatRate, versusSameLine, type Interval } from '../gains'
import { incrementLabel } from '../../growth/velocity'
import { chartPoints, growthFor, type ChartChoice } from '../growthData'
import { buildFacts } from '../facts'
import { mentionClauses } from '../mention'
import { bornAt, pretermNotice } from '../preterm'
import type { Child, Measurement } from '../types'

export type CardTile = { label: string; value: string; percentile?: string; change?: string }
export type CardChart = { choice: ChartChoice; indicator: Indicator; title: string; count: number }
export type CardBar = { label: string; rate: number; sameLine?: number; short: boolean }
export type CardRow = { date: string; age: string; weight: string; length: string; head: string }

export type CardData = {
  title: string
  subtitle: string
  generatedOn: string
  tiles: CardTile[]
  charts: CardChart[]
  gain?: { headline: string; sentence?: string; bars: CardBar[] }
  history?: CardRow[]
  highlights: string[]
  ai?: { label: string; text: string }
}

export type CardOptions = {
  title: string
  subtitle: string
  includeHead: boolean
  includeHistory: boolean
  /** The latest AI summary, if the parent chose to include it. */
  ai?: { text: string; date: string; prepared?: boolean }
}

/** "above the 99.9th" is too long for a pill on the card: "> 99.9th", "< 0.1st" (BABY-09). */
export const cardPercentile = (p: string) => p.replace(/^above the /, '> ').replace(/^below the /, '< ')

const latestWith = (ms: Measurement[], pick: (m: Measurement) => number | undefined) => [...ms].reverse().find((m) => pick(m) !== undefined)

function signed(text: string, n: number): string {
  return n < 0 ? text : `+${text}`
}

function weightChange(kg: number, units: Units): string {
  if (units === 'imperial') {
    const oz = (Math.abs(kg) / KG_PER_LB) * 16
    return `${kg < 0 ? '−' : ''}${oz.toFixed(1)} oz`
  }
  return Math.abs(kg) < 1 ? `${kg < 0 ? '−' : ''}${Math.round(Math.abs(kg) * 1000)} g` : `${kg < 0 ? '−' : ''}${Math.abs(kg).toFixed(2)} kg`
}

function lengthChange(cm: number, units: Units): string {
  return `${cm < 0 ? '−' : ''}${formatLength(Math.abs(cm), units)}`
}

// "5 months, 30 days" → "5 mo 30 d", for tables.
export function compactAge(text: string): string {
  return text
    .replace(/(\d+) years?/, '$1 y')
    .replace(/(\d+) months?/, '$1 mo')
    .replace(/(\d+) days?/, '$1 d')
    .replace(/, /g, ' ')
}

// Markdown from a summary, as plain text: its first paragraph, without bold or bullets.
export function plainFirstParagraph(markdown: string): string {
  const para = markdown.trim().split(/\n\s*\n/)[0] ?? ''
  return para
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildCardData(tables: Tables, child: Child, measurements: Measurement[], units: Units, now: string, opts: CardOptions): CardData {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const series = allIntervals(tables, child, sorted)
  const ageNow = ageInDays(child.dateOfBirth, now)

  // Latest numbers, each with its percentile and the change since the previous measurement of that kind.
  const tile = (label: string, pick: (m: Measurement) => number | undefined, indicator: Indicator, show: (v: number) => string, last: Interval | undefined, change: (d: number) => string): CardTile => {
    const m = latestWith(sorted, pick)
    if (!m) return { label, value: '—' }
    const z = growthFor(tables, child, m)[indicator]?.z
    return {
      label,
      value: show(pick(m)!),
      percentile: z !== undefined ? `${cardPercentile(formatPercentile(z))} percentile` : undefined,
      change: last && last.to.id === m.id ? `${signed(change(last.change), last.change)} since ${formatShortDate(last.from.date)}` : undefined,
    }
  }
  const stature = latestWith(sorted, (m) => m.lengthCm ?? m.heightCm)
  const tiles: CardTile[] = [
    tile('Weight', (m) => m.weightKg, 'wfa', (v) => formatWeight(v, units), series.weight.at(-1), (d) => weightChange(d, units)),
    tile(stature?.lengthCm === undefined && stature?.heightCm !== undefined ? 'Height' : 'Length', (m) => m.lengthCm ?? m.heightCm, 'lhfa', (v) => formatLength(v, units), series.length.at(-1), (d) => lengthChange(d, units)),
  ]
  if (opts.includeHead) tiles.push(tile('Head', (m) => m.headCm, 'hcfa', (v) => formatLength(v, units), series.head.at(-1), (d) => lengthChange(d, units)))

  // Charts: weight, length and head for age, and weight for length (or height from 2 years).
  const toddler = ageNow >= HEIGHT_FROM_DAY
  const wanted: [ChartChoice, string][] = [
    ['wfa', 'Weight for age'],
    ['lhfa', toddler ? 'Height for age' : 'Length for age'],
    ...(opts.includeHead ? [['hcfa', 'Head circumference for age'] as [ChartChoice, string]] : []),
    ['wfl', toddler ? 'Weight for height' : 'Weight for length'],
  ]
  const charts = wanted.flatMap(([choice, title]) => {
    const { indicator, points } = chartPoints(tables, child, sorted, choice, ageNow)
    return points.length ? [{ choice, indicator, title, count: points.length }] : []
  })

  // Gain over time: weight, the latest interval long enough to say something.
  const weight = series.weight
  const latestGain = [...weight].reverse().find((i) => !i.short) ?? weight.at(-1)
  let gain: CardData['gain']
  if (latestGain) {
    const v = versusSameLine(latestGain)
    gain = {
      headline: `${formatRate(latestGain, latestGain.rate, units)} since ${formatShortDate(latestGain.from.date)}`,
      sentence:
        latestGain.short || !v || latestGain.sameLine === undefined
          ? undefined
          : `Same percentile line: about ${formatRate(latestGain, latestGain.sameLine, units)}${v === 'about the same' ? ', about the same' : `, so this was ${v}`}.`,
      bars: weight.slice(-8).map((i) => ({ label: formatShortDate(i.to.date), rate: i.rate, sameLine: i.sameLine, short: i.short })),
    }
  }

  // History, newest first.
  const history = opts.includeHistory
    ? [...sorted].reverse().map((m) => ({
        date: formatDate(m.date),
        age: compactAge(formatAge(child.dateOfBirth, m.date)),
        weight: m.weightKg !== undefined ? formatWeight(m.weightKg, units) : '',
        length: (m.lengthCm ?? m.heightCm) !== undefined ? formatLength((m.lengthCm ?? m.heightCm)!, units) : '',
        head: opts.includeHead && m.headCm !== undefined ? formatLength(m.headCm, units) : '',
      }))
    : undefined

  // Highlights, written by the code: where each measure has been lately. Neutral: no "good",
  // "normal" or "healthy". Gain over time has its own block, so it isn't repeated here.
  const highlights: string[] = []
  // The last few in order, so the direction shows (BABY-08): "Weight: 88th → 59th → 2nd percentile".
  const range = (label: string, indicator: Indicator, pick: (m: Measurement) => number | undefined) => {
    const zs = sorted
      .filter((m) => pick(m) !== undefined)
      .slice(-3)
      .map((m) => growthFor(tables, child, m)[indicator]?.z)
      .filter((z): z is number => z !== undefined)
    if (zs.length < 2) return
    const shown = zs.map((z) => cardPercentile(formatPercentile(z)))
    const same = shown.every((p) => p === shown[0])
    highlights.push(`${label}: ${same ? shown[0] : shown.join(' → ')} percentile (last ${zs.length} measurements)`)
  }
  // First, what the code found worth mentioning (BABY-03) and, for a baby born early, how the
  // percentiles are counted (BABY-01): short versions of the overview's notes.
  const facts = buildFacts(tables, child, sorted, now)
  const mention = facts && mentionClauses(facts)
  if (mention) highlights.push(`Worth mentioning at the next check-up: ${mention}. Not a diagnosis.`)
  if (pretermNotice(child, now)) highlights.push(`Born at ${bornAt(child)}: these percentiles use age from birth, not corrected age.`)
  if (latestGain?.who) highlights.push(`Weight gain ${incrementLabel(latestGain.who)}: ${formatPercentile(latestGain.who.z)} percentile of WHO's gains`)
  range('Weight', 'wfa', (m) => m.weightKg)
  range(toddler ? 'Height' : 'Length', 'lhfa', (m) => m.lengthCm ?? m.heightCm)
  if (opts.includeHead) range('Head', 'hcfa', (m) => m.headCm)
  const both = latestWith(sorted, (m) => (m.weightKg !== undefined && (m.lengthCm ?? m.heightCm) !== undefined ? 1 : undefined))
  if (both) {
    const g = growthFor(tables, child, both)
    const wfl = g.wfl ?? g.wfh
    if (wfl) highlights.push(`${toddler ? 'Weight for height' : 'Weight for length'}: ${cardPercentile(formatPercentile(wfl.z))} percentile`)
  }

  // Girl or Boy (the charts are sex-specific) and weeks at birth, under the age (BABY-09).
  const born = bornAt(child)
  return {
    title: opts.title,
    subtitle: [opts.subtitle, child.sex === 'female' ? 'Girl' : 'Boy', born && `born at ${born}`].filter(Boolean).join(' · '),
    generatedOn: formatDate(now),
    tiles,
    charts,
    gain,
    history,
    highlights,
    ai: opts.ai
      ? { label: opts.ai.prepared ? 'In plain words · prepared in advance for the demo' : `In plain words · written by AI on ${formatDate(opts.ai.date)}`, text: plainFirstParagraph(opts.ai.text) }
      : undefined,
  }
}
