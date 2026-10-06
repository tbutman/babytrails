import { LineChart } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { GrowthChart, type ChartPoint } from '../../growth/GrowthChart'
import type { Indicator } from '../../growth/tables'
import { EmptyState, PageHeader, Segmented } from '../../core/ui/components'
import { Disclaimer } from '../components'
import { useChild, useMeasurements } from '../data'
import { formatAge, formatDate } from '../format'
import { growthFor, useTables } from '../growthData'
import { useSession } from '../sessionContext'
import { today } from '../types'

type Choice = 'wfa' | 'lhfa' | 'hcfa' | 'wfl' | 'bfa'

export function Charts() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const measurements = useMeasurements(id)
  const tables = useTables()
  const { app } = useSession()
  const [chart, setChart] = useState<Choice>('wfa')
  if (!child || measurements === null) return null

  const ageNow = ageInDays(child.dateOfBirth, today())
  const toddler = ageNow >= HEIGHT_FROM_DAY
  const indicator: Indicator = chart === 'wfl' && toddler ? 'wfh' : chart
  const points: ChartPoint[] = tables
    ? measurements.flatMap((m) => {
        const g = growthFor(tables, child, m)
        const label = `${formatDate(m.date)}, ${formatAge(child.dateOfBirth, m.date)}`
        if (chart === 'wfl') {
          const r = g[indicator]
          return r && g.statureCm !== undefined ? [{ x: g.statureCm, y: r.value, label }] : []
        }
        const r = g[chart]
        return r ? [{ x: ageInDays(child.dateOfBirth, m.date), y: r.value, label }] : []
      })
    : []

  return (
    <>
      <PageHeader title="Growth charts" subtitle="Against the WHO Child Growth Standards, birth to 5 years" />
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
      {measurements.length === 0 ? (
        <EmptyState icon={LineChart} title="Nothing to chart yet">
          Add a measurement and it appears here against the WHO percentile bands.
        </EmptyState>
      ) : tables ? (
        <div className="card chart-card">
          <GrowthChart tables={tables} indicator={indicator} sex={child.sex} points={points} units={app.units} ageDaysNow={ageNow} />
        </div>
      ) : (
        <div className="skeleton loading-card" />
      )}
      <Disclaimer />
    </>
  )
}
