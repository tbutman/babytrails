import { Info, LineChart } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { CHART_TITLES } from '../../growth/chartTitles'
import { GrowthChart, type ChartPoint } from '../../growth/GrowthChart'
import { formatLength, formatWeight, type Units } from '../../growth/units'
import type { Indicator } from '../../growth/tables'
import { Callout, EmptyState, PageHeader, Segmented } from '../../core/ui/components'
import { Disclaimer } from '../components'
import { useChild, useCountedMeasurements } from '../data'
import { chartPoints, notChartedNote, useTables, type ChartChoice } from '../growthData'
import { pretermNotice } from '../preterm'
import { useSession } from '../sessionContext'
import { today } from '../types'

type Choice = ChartChoice

export function Charts() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const measurements = useCountedMeasurements(id)
  const tables = useTables()
  const { app } = useSession()
  const [chart, setChart] = useState<Choice>('wfa')
  if (!child || measurements === null) return null

  const ageNow = ageInDays(child.dateOfBirth, today())
  const toddler = ageNow >= HEIGHT_FROM_DAY
  const { indicator, points } = tables ? chartPoints(tables, child, measurements, chart, ageNow) : { indicator: (chart === 'wfl' && toddler ? 'wfh' : chart) as Indicator, points: [] as ChartPoint[] }

  return (
    <>
      <PageHeader title="Growth charts" subtitle="Against the WHO Child Growth Standards, birth to 5 years" />
      {pretermNotice(child, today()) && (
        <Callout icon={Info} tone="accent">
          <p>{pretermNotice(child, today())}</p>
        </Callout>
      )}
      <div className="no-print">
      <Segmented
        legend="Chart"
        name="chart"
        value={chart}
        onChange={setChart}
        options={[
          { value: 'wfa', label: 'Weight' },
          { value: 'lhfa', label: toddler ? 'Height' : 'Length' },
          { value: 'hcfa', label: 'Head' },
          { value: 'wfl', label: toddler ? 'Wt/height' : 'Wt/length' },
          { value: 'bfa', label: 'BMI' },
        ]}
      />
      </div>
      <p className="hint chart-explainer">
        A percentile compares your baby with WHO's reference babies of the same age and sex: at the 50th, half measured less. How a baby follows a
        line over time matters more than any one point.
      </p>
      {measurements.length === 0 ? (
        <EmptyState icon={LineChart} title="Nothing to chart yet">
          Add a measurement and it appears here against the WHO percentile bands.
        </EmptyState>
      ) : tables ? (
        <>
          {points.length > 0 && (
            <p className="chart-latest">
              Latest: <strong>{points.at(-1)!.percentile} percentile</strong> <span className="muted">({points.at(-1)!.label})</span>
            </p>
          )}
          <div className="card chart-card">
            <GrowthChart tables={tables} indicator={indicator} sex={child.sex} points={points} units={app.units} ageDaysNow={ageNow} />
          </div>
          {notChartedNote(child, measurements, chart) && <p className="hint">{notChartedNote(child, measurements, chart)}</p>}
          {points.length > 0 && <ChartTable points={points} indicator={indicator} units={app.units} />}
        </>
      ) : (
        <div className="skeleton loading-card" />
      )}
      <Disclaimer />
    </>
  )
}

/** The same points as a table, for anyone who'd rather read than look (BABY-10). */
function ChartTable({ points, indicator, units }: { points: ChartPoint[]; indicator: Indicator; units: Units }) {
  const byLength = indicator === 'wfl' || indicator === 'wfh'
  const value = (p: ChartPoint) => {
    if (indicator === 'wfa' || byLength) return formatWeight(p.y, units)
    if (indicator === 'bfa') return `${p.y.toFixed(1)} kg/m²`
    return formatLength(p.y, units)
  }
  return (
    <details className="disclosure no-print">
      <summary>Show as a table</summary>
      <div className="disclosure-body table-scroll">
        <table className="gain-table">
          <thead>
            <tr>
              <th scope="col">Date and age</th>
              {byLength && <th scope="col">{indicator === 'wfh' ? 'Height' : 'Length'}</th>}
              <th scope="col">{CHART_TITLES[indicator].split(' for ')[0].replace('Length/height', 'Length or height')}</th>
              <th scope="col">Percentile</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={`${p.x}-${p.label}`}>
                <td>{p.label}</td>
                {byLength && <td className="num">{formatLength(p.x, units)}</td>}
                <td className="num">{value(p)}</td>
                <td className="num">{p.percentile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
