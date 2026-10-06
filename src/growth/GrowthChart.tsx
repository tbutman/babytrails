// A WHO growth chart: percentile bands (3rd–97th and 15th–85th), the median dashed, and the child's
// measurements on top. Hand-rolled SVG so the bands, units and export stay fully under our control.

import { CHART_TITLES } from './chartTitles'
import { valueAtZ } from './lms'
import { lmsAt, tableRange, type Indicator, type Sex, type Tables } from './tables'
import { cmToIn, KG_PER_LB, type Units } from './units'

export type ChartPoint = { x: number; y: number; label: string }

const Z_BANDS = { p3: -1.881, p15: -1.036, p50: 0, p85: 1.036, p97: 1.881 }
const DAYS_PER_MONTH = 30.4375


function yUnit(indicator: Indicator, units: Units): string {
  if (indicator === 'bfa') return 'kg/m²'
  if (indicator === 'lhfa' || indicator === 'hcfa') return units === 'metric' ? 'cm' : 'in'
  return units === 'metric' ? 'kg' : 'lb'
}

function toDisplayY(indicator: Indicator, units: Units, y: number): number {
  if (units === 'metric' || indicator === 'bfa') return y
  if (indicator === 'lhfa' || indicator === 'hcfa') return cmToIn(y)
  return y / KG_PER_LB
}

function niceStep(span: number, target: number): number {
  const raw = span / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
}

function ageLabel(days: number): string {
  const months = Math.round(days / DAYS_PER_MONTH)
  if (months === 0) return 'Birth'
  if (months % 12 === 0) return `${months / 12} y`
  return `${months} mo`
}

type Props = {
  tables: Tables
  indicator: Indicator
  sex: Sex
  points: ChartPoint[]
  units: Units
  // For age charts: the child's age today, so the chart reaches it.
  ageDaysNow?: number
  // The legend under the chart; off where the page explains the chart itself.
  caption?: boolean
}

const W = 360
const H = 240
const M = { top: 24, right: 12, bottom: 30, left: 40 }

export function GrowthChart({ tables, indicator, sex, points, units, ageDaysNow = 0, caption = true }: Props) {
  const table = tables[indicator]
  const [tMin, tMax] = tableRange(table)
  const byAge = table.x === 'day'

  // x domain: for age charts from birth to a little past the latest point; for length charts around
  // the child's measurements.
  let x0: number
  let x1: number
  if (byAge) {
    const latest = Math.max(ageDaysNow, ...points.map((p) => p.x), 0)
    const months = Math.min(60, Math.max(6, Math.ceil((latest * 1.15) / DAYS_PER_MONTH)))
    x0 = 0
    x1 = Math.min(tMax, Math.round(months * DAYS_PER_MONTH))
  } else {
    const xs = points.map((p) => p.x)
    x0 = Math.max(tMin, Math.floor((xs.length ? Math.min(...xs) : 50) - 5))
    x1 = Math.min(tMax, Math.ceil((xs.length ? Math.max(...xs) : 70) + 5))
  }

  // Sample the bands across the domain.
  const samples: { x: number; v: Record<keyof typeof Z_BANDS, number> }[] = []
  const stepX = byAge ? Math.max(1, Math.round((x1 - x0) / 120)) : 0.5
  for (let x = x0; x <= x1 + 1e-9; x += stepX) {
    const lms = lmsAt(table, sex, Math.min(x, x1))
    if (!lms) continue
    const v = Object.fromEntries(
      Object.entries(Z_BANDS).map(([k, z]) => [k, toDisplayY(indicator, units, valueAtZ(lms, z))]),
    ) as Record<keyof typeof Z_BANDS, number>
    samples.push({ x: Math.min(x, x1), v })
  }
  const shown = points.filter((p) => p.x >= x0 && p.x <= x1).map((p) => ({ ...p, y: toDisplayY(indicator, units, p.y) }))

  const allY = [...samples.flatMap((s) => [s.v.p3, s.v.p97]), ...shown.map((p) => p.y)]
  const yStep = niceStep(Math.max(...allY) - Math.min(...allY), 5)
  const y0 = Math.floor(Math.min(...allY) / yStep) * yStep
  const y1 = Math.ceil(Math.max(...allY) / yStep) * yStep

  const sx = (x: number) => M.left + ((x - x0) / (x1 - x0)) * (W - M.left - M.right)
  const sy = (y: number) => H - M.bottom - ((y - y0) / (y1 - y0)) * (H - M.top - M.bottom)
  const line = (key: keyof typeof Z_BANDS) => samples.map((s, i) => `${i ? 'L' : 'M'}${sx(s.x).toFixed(1)} ${sy(s.v[key]).toFixed(1)}`).join(' ')
  const band = (lo: keyof typeof Z_BANDS, hi: keyof typeof Z_BANDS) =>
    `${line(hi)} ${samples
      .slice()
      .reverse()
      .map((s) => `L${sx(s.x).toFixed(1)} ${sy(s.v[lo]).toFixed(1)}`)
      .join(' ')} Z`

  const xTicks: number[] = []
  if (byAge) {
    const months = Math.round(x1 / DAYS_PER_MONTH)
    const every = months <= 12 ? (months <= 6 ? 1 : 2) : months <= 24 ? 3 : 6
    for (let m = 0; m <= months; m += every) xTicks.push(m * DAYS_PER_MONTH)
  } else {
    const step = niceStep(x1 - x0, 6)
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) xTicks.push(x)
  }
  const yTicks: number[] = []
  for (let y = y0; y <= y1 + 1e-9; y += yStep) yTicks.push(Math.round(y * 1000) / 1000)

  const unit = yUnit(indicator, units)
  const last = shown.at(-1)
  const summary = `${CHART_TITLES[indicator]}, WHO percentile bands. ${shown.length} measurement${shown.length === 1 ? '' : 's'}${
    last ? `; latest ${last.y.toFixed(1)} ${unit} (${last.label})` : ''
  }.`

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {yTicks.map((y) => (
          <g key={`y${y}`}>
            <line className="chart-grid" x1={M.left} x2={W - M.right} y1={sy(y)} y2={sy(y)} />
            <text className="chart-tick" x={M.left - 6} y={sy(y) + 4} textAnchor="end">
              {Number.isInteger(y) ? y : y.toFixed(1)}
            </text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={`x${x}`} className="chart-tick" x={sx(x)} y={H - M.bottom + 16} textAnchor="middle">
            {byAge ? ageLabel(x) : (units === 'metric' ? x : cmToIn(x)).toFixed(0)}
          </text>
        ))}
        <text className="chart-tick" x={M.left} y={12} textAnchor="start">
          {unit}
        </text>
        {!byAge && (
          <text className="chart-tick" x={W - M.right} y={H - 2} textAnchor="end">
            {units === 'metric' ? 'cm' : 'in'}
          </text>
        )}
        <path className="chart-band-outer" d={band('p3', 'p97')} />
        <path className="chart-band-inner" d={band('p15', 'p85')} />
        <path className="chart-median" d={line('p50')} />
        {shown.length > 1 && (
          <path className="chart-child-line" d={shown.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')} />
        )}
        {shown.map((p) => (
          <circle key={`${p.x}-${p.label}`} className="chart-child-point" cx={sx(p.x)} cy={sy(p.y)} r={4}>
            <title>{p.label}</title>
          </circle>
        ))}
      </svg>
      {caption && <figcaption>Shaded: 3rd–97th and 15th–85th percentiles. Dashed: 50th. Source: WHO Child Growth Standards.</figcaption>}
    </figure>
  )
}
