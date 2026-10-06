import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ageInDays } from '../../growth/growth'
import { CHART_TITLES } from '../../growth/chartTitles'
import { GrowthChart, type ChartPoint } from '../../growth/GrowthChart'
import { formatPercentile } from '../../growth/lms'
import type { Indicator } from '../../growth/tables'
import { formatLength, formatWeeklyGain, formatWeight } from '../../growth/units'
import { Disclaimer, Page } from '../components'
import { useChild, useMeasurements } from '../data'
import { formatAge, formatDate } from '../format'
import { growthFor, useTables, weeklyGain } from '../growthData'
import { useSession } from '../sessionContext'
import { today, type Measurement } from '../types'
import { BackupNudge } from './Settings'
import { SummaryCard } from './Summaries'

const CHARTS: Indicator[] = ['wfa', 'lhfa', 'hcfa', 'wfl', 'bfa']

export function ChildPage() {
  const { id } = useParams()
  const child = useChild(id)
  const measurements = useMeasurements(id)
  const tables = useTables()
  const { app } = useSession()
  const [chart, setChart] = useState<Indicator>('wfa')

  if (child === undefined || measurements === null) return null
  if (child === null) return <Page title="Not found">This child isn't in your records.</Page>

  const units = app.units
  const now = today()
  const latestOf = (key: 'weightKg' | 'statureCm' | 'headCm') =>
    [...measurements].reverse().find((m) => (key === 'statureCm' ? m.lengthCm ?? m.heightCm : m[key]) !== undefined)
  const gain = weeklyGain(measurements)

  const pointsFor = (indicator: Indicator): ChartPoint[] => {
    if (!tables) return []
    return measurements.flatMap((m) => {
      const g = growthFor(tables, child, m)
      const age = ageInDays(child.dateOfBirth, m.date)
      const label = `${formatDate(m.date)}, ${formatAge(child.dateOfBirth, m.date)}`
      if (indicator === 'wfl') {
        const r = g.wfl
        return r && g.statureCm !== undefined ? [{ x: g.statureCm, y: r.value, label }] : []
      }
      const r = g[indicator]
      return r ? [{ x: age, y: r.value, label }] : []
    })
  }

  const stat = (label: string, m: Measurement | undefined, value: string | undefined, indicator: Indicator) => {
    const z = m && tables ? growthFor(tables, child, m)[indicator]?.z : undefined
    return (
      <div className="stat">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value ?? '—'}</div>
        {m && (
          <div className="stat-label">
            {z !== undefined ? `${formatPercentile(z)} percentile · ` : ''}
            {formatDate(m.date)}
          </div>
        )}
      </div>
    )
  }

  const w = latestOf('weightKg')
  const s = latestOf('statureCm')
  const h = latestOf('headCm')
  const ageNow = ageInDays(child.dateOfBirth, now)

  return (
    <Page>
      <BackupNudge />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>{child.nickname || child.name}</h1>
          <p className="muted">{formatAge(child.dateOfBirth, now)} old</p>
        </div>
        <Link to={`/child/${child.id}/edit`} className="button ghost small">
          Edit
        </Link>
      </div>

      <div className="stats">
        {stat('Weight', w, w?.weightKg !== undefined ? formatWeight(w.weightKg, units) : undefined, 'wfa')}
        {stat(
          s?.heightCm !== undefined && s.lengthCm === undefined ? 'Height' : 'Length',
          s,
          s ? formatLength((s.lengthCm ?? s.heightCm)!, units) : undefined,
          'lhfa',
        )}
        {stat('Head', h, h?.headCm !== undefined ? formatLength(h.headCm, units) : undefined, 'hcfa')}
      </div>
      {gain && (
        <p>
          Since {formatDate(gain.from.date)}: <strong>{formatWeeklyGain(gain.kgPerWeek, units)}</strong> over {gain.days} days.
        </p>
      )}

      <div className="row">
        <Link to={`/child/${child.id}/measure`} className="button primary">
          Add a measurement
        </Link>
        <Link to={`/child/${child.id}/documents`} className="button">
          Documents
        </Link>
      </div>

      {measurements.length > 0 && (
        <>
          <h2>In plain words</h2>
          <SummaryCard child={child} kind="after-data" />
          <SummaryCard child={child} kind="questions" />
          <div className="row">
            <Link to={`/child/${child.id}/summary?kind=after-data`} className="button small">
              Explain the latest changes
            </Link>
            <Link to={`/child/${child.id}/summary?kind=questions`} className="button small">
              Questions for the next check-up
            </Link>
          </div>
          <p className="hint">Uses AI with your own key. BabyTrails calculates the numbers; the AI only puts them into words.</p>
        </>
      )}

      <h2>Growth charts</h2>
      <div className="chart-tabs" role="group" aria-label="Choose a chart">
        {CHARTS.map((c) => (
          <button key={c} type="button" aria-pressed={chart === c} onClick={() => setChart(c)}>
            {c === 'lhfa' ? (ageNow < 731 ? 'Length' : 'Height') : c === 'wfl' ? (ageNow < 731 ? 'Weight for length' : 'Weight for height') : CHART_TITLES[c].replace(' for age', '')}
          </button>
        ))}
      </div>
      {tables ? (
        <GrowthChart
          tables={tables}
          indicator={chart === 'wfl' && ageNow >= 731 ? 'wfh' : chart}
          sex={child.sex}
          points={pointsFor(chart)}
          units={units}
          ageDaysNow={ageNow}
        />
      ) : (
        <p className="muted">Loading the WHO charts…</p>
      )}

      <h2>Measurements</h2>
      {measurements.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="measure-list">
          {[...measurements].reverse().map((m) => (
            <li key={m.id}>
              <Link to={`/child/${child.id}/measure/${m.id}`}>
                <span>
                  <strong>{formatDate(m.date)}</strong> <span className="muted">· {formatAge(child.dateOfBirth, m.date)}</span>
                </span>
                <span className="muted">Edit</span>
                <span className="muted" style={{ gridColumn: '1 / -1' }}>
                  {[
                    m.weightKg !== undefined && formatWeight(m.weightKg, units),
                    m.lengthCm !== undefined && `${formatLength(m.lengthCm, units)} long`,
                    m.heightCm !== undefined && `${formatLength(m.heightCm, units)} tall`,
                    m.headCm !== undefined && `head ${formatLength(m.headCm, units)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Disclaimer />
    </Page>
  )
}
