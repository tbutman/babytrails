// Gain over time on the overview: the latest gain, the gain that would have kept the same percentile
// line, and a bar for each interval. Everything is computed in gains.ts.

import { TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { Units } from '../growth/units'
import { Segmented } from '../core/ui/components'
import { formatDate, formatShortDate } from './format'
import { formatRate, sameLineSentence, type Interval, type Measure } from './gains'

const LABELS: Record<Measure, string> = { weight: 'Weight', length: 'Length', head: 'Head' }
const MAX_BARS = 8

export function GainCard({ series, units }: { series: Record<Measure, Interval[]>; units: Units }) {
  const available = (Object.keys(series) as Measure[]).filter((k) => series[k].length >= (k === 'weight' ? 1 : 2))
  const [measure, setMeasure] = useState<Measure>('weight')
  if (available.length === 0) return null
  const shown = available.includes(measure) ? measure : available[0]
  const list = series[shown]
  const latest = list.at(-1)!
  const sentence = sameLineSentence(latest, units)

  return (
    <section className="card gain-card" aria-labelledby="gain-title">
      <div className="gain-head">
        <h2 id="gain-title" className="section-title">
          <TrendingUp size={18} aria-hidden /> Gain over time
        </h2>
        {available.length > 1 && (
          <Segmented legend="Measurement" name="gain-measure" options={available.map((k) => ({ value: k, label: LABELS[k] }))} value={shown} onChange={setMeasure} />
        )}
      </div>
      <p className="gain-latest">
        <span className="gain-value num">{formatRate(latest, latest.rate, units)}</span>
        <span className="muted">
          {' '}
          since {formatDate(latest.from.date)}, over {latest.days} days
        </span>
      </p>
      {latest.short ? (
        <p className="hint">Only {latest.days} days apart: differences between scales or measurers can matter more than the change itself.</p>
      ) : (
        sentence && <p className="hint">{sentence}</p>
      )}
      {list.length > 1 && <GainBars list={list.slice(-MAX_BARS)} units={units} />}
      <details className="disclosure">
        <summary>Every interval</summary>
        <div className="disclosure-body table-scroll">
          <table className="gain-table">
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Days</th>
                <th scope="col">Gain</th>
                <th scope="col">Same line</th>
              </tr>
            </thead>
            <tbody>
              {[...list].reverse().map((i) => (
                <tr key={`${i.from.id}-${i.to.id}`} className={i.short ? 'faint' : undefined}>
                  <td>{formatShortDate(i.from.date)}</td>
                  <td>{formatShortDate(i.to.date)}</td>
                  <td className="num">{i.days}</td>
                  <td className="num">{formatRate(i, i.rate, units)}</td>
                  <td className="num">{i.sameLine === undefined ? '—' : formatRate(i, i.sameLine, units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">"Same line" is the gain that would have kept the same WHO percentile over the same days. Faded rows are too close together to say much.</p>
        </div>
      </details>
    </section>
  )
}

/** One bar per interval, with a tick for the same-line gain. Drawn by code from the intervals. */
function GainBars({ list, units }: { list: Interval[]; units: Units }) {
  const W = 320
  const H = 120
  const top = 8
  const bottom = 22
  const values = list.flatMap((i) => [i.rate, i.sameLine ?? 0, 0])
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const y = (v: number) => top + ((max - v) / span) * (H - top - bottom)
  const slot = W / list.length
  const bar = Math.min(28, slot * 0.6)
  const label = list.map((i) => `${formatShortDate(i.to.date)}: ${formatRate(i, i.rate, units)}`).join('; ')
  return (
    <svg className="gain-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gain per interval, oldest first. ${label}`}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="gain-axis" />
      {list.map((i, n) => {
        const cx = slot * n + slot / 2
        const y0 = y(0)
        const y1 = y(i.rate)
        return (
          <g key={`${i.from.id}-${i.to.id}`} className={i.short ? 'gain-bar short' : 'gain-bar'}>
            <rect x={cx - bar / 2} y={Math.min(y0, y1)} width={bar} height={Math.max(1, Math.abs(y1 - y0))} rx={3} />
            {i.sameLine !== undefined && <line className="gain-tick" x1={cx - bar / 2 - 4} x2={cx + bar / 2 + 4} y1={y(i.sameLine)} y2={y(i.sameLine)} />}
            <text x={cx} y={H - 6} textAnchor="middle">
              {formatShortDate(i.to.date)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
