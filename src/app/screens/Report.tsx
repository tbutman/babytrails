// The shareable report: a one-page image of the latest growth, made in the browser and saved or
// shared as a file. Privacy choices decide what's on it.

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ageInDays } from '../../growth/growth'
import { GrowthChart, type ChartPoint } from '../../growth/GrowthChart'
import { formatPercentile } from '../../growth/lms'
import type { Indicator } from '../../growth/tables'
import { formatLength, formatWeeklyGain, formatWeight } from '../../growth/units'
import { Page } from '../components'
import { useChild, useMeasurements } from '../data'
import { formatAge, formatDate } from '../format'
import { growthFor, useTables, weeklyGain } from '../growthData'
import { buildReport, serialiseChart, type ReportStat } from '../report/buildReport'
import { download, reportPdf, reportPng, shareFile } from '../report/render'
import { useSession } from '../sessionContext'
import { today, type Measurement } from '../types'

type NameMode = 'nickname' | 'name' | 'none'

export function Report() {
  const { id } = useParams()
  const child = useChild(id)
  const measurements = useMeasurements(id)
  const tables = useTables()
  const { app } = useSession()
  const [nameMode, setNameMode] = useState<NameMode>('nickname')
  const [showBirthDate, setShowBirthDate] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)

  const now = today()
  const units = app.units

  useEffect(() => {
    if (!child || !measurements || !tables || !chartRef.current) return
    const chartEl = chartRef.current.querySelector('svg')
    if (!chartEl) return
    const latest = (pick: (m: Measurement) => number | undefined) => [...measurements].reverse().find((m) => pick(m) !== undefined)
    const stat = (label: string, m: Measurement | undefined, value: string | undefined, indicator: Indicator): ReportStat => {
      const z = m ? growthFor(tables, child, m)[indicator]?.z : undefined
      return { label, value: value ?? '—', percentile: z !== undefined ? `${formatPercentile(z)} percentile` : undefined }
    }
    const w = latest((m) => m.weightKg)
    const s = latest((m) => m.lengthCm ?? m.heightCm)
    const h = latest((m) => m.headCm)
    const gain = weeklyGain(measurements)
    const shownName = nameMode === 'name' ? child.name : nameMode === 'nickname' ? child.nickname || child.name.split(' ')[0] : 'Growth report'
    const last = measurements.at(-1)
    void buildReport({
      title: shownName,
      subtitle: showBirthDate ? `Born ${formatDate(child.dateOfBirth)}` : `${formatAge(child.dateOfBirth, now)} old`,
      generatedOn: formatDate(now),
      stats: [
        stat('Weight', w, w?.weightKg !== undefined ? formatWeight(w.weightKg, units) : undefined, 'wfa'),
        stat(s?.heightCm !== undefined && s.lengthCm === undefined ? 'Height' : 'Length', s, s ? formatLength((s.lengthCm ?? s.heightCm)!, units) : undefined, 'lhfa'),
        stat('Head', h, h?.headCm !== undefined ? formatLength(h.headCm, units) : undefined, 'hcfa'),
      ],
      trend: gain ? `+${formatWeeklyGain(gain.kgPerWeek, units)} lately`.replace('+−', '−') : undefined,
      highlights: [
        `${measurements.length} measurement${measurements.length === 1 ? '' : 's'} recorded`,
        last ? `Latest: ${formatDate(last.date)}, at ${formatAge(child.dateOfBirth, last.date)}` : 'No measurements yet',
        gain ? `Weight change since ${formatDate(gain.from.date)}: ${formatWeeklyGain(gain.kgPerWeek, units)}` : '',
      ].filter(Boolean),
      chartTitle: 'Weight for age',
      chartSvg: serialiseChart(chartEl),
    }).then(setSvg)
  }, [child, measurements, tables, nameMode, showBirthDate, units, now])


  if (!child || !measurements || !tables) return null
  const base = `babytrails-report-${now}`
  const points: ChartPoint[] = measurements.flatMap((m) => {
    const r = growthFor(tables, child, m).wfa
    return r ? [{ x: ageInDays(child.dateOfBirth, m.date), y: r.value, label: m.date }] : []
  })

  async function act(kind: 'png' | 'pdf' | 'share') {
    if (!svg) return
    setMessage('')
    if (kind === 'pdf') return download(await reportPdf(svg), `${base}.pdf`)
    const png = await reportPng(svg)
    if (kind === 'png') return download(png, `${base}.png`)
    const result = await shareFile(png, `${base}.png`, 'Growth report')
    if (result === 'unsupported') setMessage("This browser can't share files. Save the image instead and share it from your photos or files.")
  }

  return (
    <Page title="Share a report" back={`/child/${child.id}`}>
      <p>A one-page picture of the latest growth, made on this device. You choose what's on it, and you share the file yourself.</p>

      <fieldset className="field">
        <legend className="legend">Name on the report</legend>
        <div className="segmented" role="group" aria-label="Name on the report">
          <button type="button" aria-pressed={nameMode === 'nickname'} onClick={() => setNameMode('nickname')}>
            {child.nickname ? 'Nickname' : 'First name'}
          </button>
          <button type="button" aria-pressed={nameMode === 'name'} onClick={() => setNameMode('name')}>
            Full name
          </button>
          <button type="button" aria-pressed={nameMode === 'none'} onClick={() => setNameMode('none')}>
            No name
          </button>
        </div>
      </fieldset>
      <div className="checkbox">
        <input id="show-dob" type="checkbox" checked={showBirthDate} onChange={(e) => setShowBirthDate(e.target.checked)} />
        <label htmlFor="show-dob">Show the date of birth instead of the age</label>
      </div>

      <div className="report-preview">
        {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Preview of the report" /> : <p className="muted">Preparing…</p>}
      </div>

      <div className="row">
        <button type="button" className="button primary" onClick={() => void act('share')} disabled={!svg}>
          Share
        </button>
        <button type="button" className="button" onClick={() => void act('png')} disabled={!svg}>
          Save image
        </button>
        <button type="button" className="button" onClick={() => void act('pdf')} disabled={!svg}>
          Save PDF
        </button>
      </div>
      {message && <p role="status">{message}</p>}

      {/* The chart is drawn off-screen by the same component as the app, then copied into the report. */}
      <div ref={chartRef} className="offscreen" aria-hidden="true">
        <GrowthChart tables={tables} indicator="wfa" sex={child.sex} points={points} units={units} ageDaysNow={ageInDays(child.dateOfBirth, now)} />
      </div>
    </Page>
  )
}
