import { Info, LineChart } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { GrowthChart, type ChartPoint } from '../../growth/GrowthChart'
import type { Indicator } from '../../growth/tables'
import { Callout, EmptyState, PageHeader, Segmented } from '../../core/ui/components'
import { Disclaimer } from '../components'
import { useChild, useCountedMeasurements } from '../data'
import { chartPoints, useTables, type ChartChoice } from '../growthData'
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
