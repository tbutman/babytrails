// A child's overview: the latest measurements with their percentiles, gain over time, and the
// plain-language summaries.

import { FilePlus2, Pencil, Plus, Ruler, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { formatPercentile } from '../../growth/lms'
import type { Indicator } from '../../growth/tables'
import { cmToIn, kgToLbOz, KG_PER_LB, type Units } from '../../growth/units'
import { Chip, EmptyState, MetricCard, PageHeader, Sparkline } from '../../core/ui/components'
import { childPath } from '../brand'
import { Disclaimer } from '../components'
import { useChild, useCountedMeasurements } from '../data'
import { formatAge, formatDate } from '../format'
import { allIntervals } from '../gains'
import { FirstWeeks } from '../FirstWeeks'
import { GainCard } from '../GainCard'
import { growthFor, useTables } from '../growthData'
import { useSession } from '../sessionContext'
import { today, type Child, type Measurement } from '../types'
import { BackupNudge } from './Settings'
import { SummaryCard } from './Summaries'
import { AskCard } from '../AskCard'

type Metric = { label: string; indicator: Indicator; pick: (m: Measurement) => number | undefined; show: (v: number, u: Units) => { value: string; unit?: string } }

const length = (v: number, u: Units) => (u === 'metric' ? { value: v.toFixed(1), unit: 'cm' } : { value: cmToIn(v).toFixed(1), unit: 'in' })
const METRICS: Metric[] = [
  {
    label: 'Weight',
    indicator: 'wfa',
    pick: (m) => m.weightKg,
    show: (v, u) => {
      if (u === 'metric') return { value: v.toFixed(v < 10 ? 2 : 1), unit: 'kg' }
      const { lb, oz } = kgToLbOz(v)
      return { value: `${lb} lb ${oz}`, unit: 'oz' }
    },
  },
  { label: 'Length or height', indicator: 'lhfa', pick: (m) => m.lengthCm ?? m.heightCm, show: length },
  { label: 'Head circumference', indicator: 'hcfa', pick: (m) => m.headCm, show: length },
]

export function Overview() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const measurements = useCountedMeasurements(id)
  if (!child || measurements === null) return null
  return <OverviewInner child={child} measurements={measurements} />
}

function OverviewInner({ child, measurements }: { child: Child; measurements: Measurement[] }) {
  const tables = useTables()
  const { app } = useSession()
  const units = app.units
  const now = today()
  const series = tables ? allIntervals(tables, child, measurements) : null

  return (
    <>
      <PageHeader
        title={child.nickname || child.name}
        subtitle={`${formatAge(child.dateOfBirth, now)} old · ${child.sex === 'female' ? 'Girl' : 'Boy'}`}
        actions={
          <>
            <Link className="button ghost small" to={childPath(child.id, 'edit')}>
              <Pencil size={14} aria-hidden /> Edit
            </Link>
            <Link className="button primary" to={childPath(child.id, 'measurements/new')}>
              <Plus size={16} aria-hidden /> Add a measurement
            </Link>
          </>
        }
      />
      <BackupNudge />

      {measurements.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No measurements yet"
          action={
            <div className="row">
              <Link className="button primary" to={childPath(child.id, 'measurements/new')}>
                <Plus size={16} aria-hidden /> Add a measurement
              </Link>
              <Link className="button" to={childPath(child.id, 'documents/import')}>
                <FilePlus2 size={16} aria-hidden /> Add a growth report
              </Link>
            </div>
          }
        >
          Type in the numbers from a check-up, or add a growth report and let the AI read it for you to check.
        </EmptyState>
      ) : (
        <>
          <div className="metric-grid overview-metrics">
            {METRICS.map((metric) => {
              const series = measurements.filter((m) => metric.pick(m) !== undefined)
              const latest = series.at(-1)
              if (!latest) {
                return <MetricCard key={metric.label} label={metric.label} value="—" foot="Not measured yet" />
              }
              const z = tables ? growthFor(tables, child, latest)[metric.indicator]?.z : undefined
              const shown = metric.show(metric.pick(latest)!, units)
              const toDisplay = (v: number) => (metric.indicator === 'wfa' ? (units === 'metric' ? v : v / KG_PER_LB) : units === 'metric' ? v : cmToIn(v))
              return (
                <MetricCard
                  key={metric.label}
                  to={childPath(child.id, 'charts')}
                  label={metric.label}
                  value={shown.value}
                  unit={shown.unit}
                  chips={z !== undefined && <Chip tone="accent">{formatPercentile(z)} percentile</Chip>}
                  foot={`${formatDate(latest.date)} · at ${formatAge(child.dateOfBirth, latest.date)}`}
                >
                  {series.length > 1 && <Sparkline points={series.slice(-8).map((m) => ({ value: toDisplay(metric.pick(m)!) }))} label={`${metric.label}, last ${Math.min(series.length, 8)} measurements`} />}
                </MetricCard>
              )
            })}
          </div>

          <FirstWeeks child={child} measurements={measurements} units={units} />
          {series && <GainCard series={series} units={units} />}

          <h2 className="section-title">
            <Sparkles size={18} aria-hidden /> In plain words
          </h2>
          <SummaryCard child={child} kind="after-data" />
          <SummaryCard child={child} kind="questions" />
          <div className="row summary-actions">
            <Link className="button" to={`${childPath(child.id, 'summary')}?kind=after-data`}>
              Explain the latest changes
            </Link>
            <Link className="button" to={`${childPath(child.id, 'summary')}?kind=questions`}>
              Questions for the next check-up
            </Link>
          </div>
          <p className="hint">Uses AI with your own key. BabyTrails calculates the numbers; the AI only puts them into words.</p>
          <AskCard child={child} measurements={measurements} />
        </>
      )}
      <Disclaimer />
    </>
  )
}

