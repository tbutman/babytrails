// The shareable report, made in the browser and saved or shared as a file: the report card (a
// phone-shaped image, or an A4 PDF) or the simple one-page report. Privacy choices decide what's on it.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ageInDays } from '../../growth/growth'
import { GrowthChart, type ChartPoint } from '../../growth/GrowthChart'
import { formatPercentile } from '../../growth/lms'
import type { Indicator } from '../../growth/tables'
import { formatLength, formatWeeklyGain, formatWeight } from '../../growth/units'
import { FileDown, ImageDown, Share2 } from 'lucide-react'
import { Checkbox, PageHeader, Segmented } from '../../core/ui/components'
import { buildCard, CARD_SIZE, type CardLayout } from '../report/buildCard'
import { buildCardData } from '../report/cardData'
import { useLatestSummary } from '../summaries'
import { useChild, useMeasurements } from '../data'
import { formatAge, formatDate } from '../format'
import { chartPoints, growthFor, useTables, weeklyGain, type ChartChoice } from '../growthData'
import { buildReport, serialiseChart, type ReportStat } from '../report/buildReport'
import { download, reportPdf, reportPng, shareFile, type PageSize } from '../report/render'
import { useSession } from '../sessionContext'
import { today, type Child, type Measurement } from '../types'

type NameMode = 'nickname' | 'name' | 'none'
type Layout = 'card' | 'simple'
const CARD_CHARTS: ChartChoice[] = ['wfa', 'lhfa', 'hcfa', 'wfl']

export function Report() {
  const { id } = useParams()
  const child = useChild(id)
  const measurements = useMeasurements(id)
  const tables = useTables()
  const { app } = useSession()
  const [nameMode, setNameMode] = useState<NameMode>('nickname')
  const [showBirthDate, setShowBirthDate] = useState(false)
  const [layout, setLayout] = useState<Layout>('card')
  const [includeHead, setIncludeHead] = useState(true)
  const [includeHistory, setIncludeHistory] = useState(true)
  const [includeAi, setIncludeAi] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)
  const cardChartsRef = useRef<HTMLDivElement>(null)
  const { summary } = useLatestSummary(child, 'after-data')

  const now = today()
  const units = app.units

  // The report card, as a function so the PDF can ask for the A4 layout.
  const cardSvg = useCallback(
    async (cardLayout: CardLayout) => {
      if (!child || !measurements || !tables || !cardChartsRef.current) return null
      const charts: Record<string, string> = {}
      cardChartsRef.current.querySelectorAll<HTMLElement>('[data-choice]').forEach((el) => {
        const svgEl = el.querySelector('svg')
        if (svgEl) charts[el.dataset.choice!] = serialiseChart(svgEl)
      })
      const data = buildCardData(tables, child, measurements, units, now, {
        title: shownName(child, nameMode),
        subtitle: showBirthDate ? `Born ${formatDate(child.dateOfBirth)}` : `${formatAge(child.dateOfBirth, now)} old`,
        includeHead,
        includeHistory,
        ai: includeAi && summary ? { text: summary.text, date: summary.createdAt.slice(0, 10), prepared: summary.model === 'prepared in advance' } : undefined,
      })
      return buildCard(data, charts, cardLayout)
    },
    [child, measurements, tables, units, now, nameMode, showBirthDate, includeHead, includeHistory, includeAi, summary],
  )

  useEffect(() => {
    if (layout !== 'card') return
    void cardSvg('phone').then((s) => s && setSvg(s))
  }, [layout, cardSvg])

  useEffect(() => {
    if (layout !== 'simple' || !child || !measurements || !tables || !chartRef.current) return
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
    const last = measurements.at(-1)
    void buildReport({
      title: shownName(child, nameMode),
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
  }, [layout, child, measurements, tables, nameMode, showBirthDate, units, now])


  if (!child || !measurements || !tables) return null
  const base = `babytrails-report-${now}`
  const points: ChartPoint[] = measurements.flatMap((m) => {
    const r = growthFor(tables, child, m).wfa
    return r ? [{ x: ageInDays(child.dateOfBirth, m.date), y: r.value, label: m.date }] : []
  })

  async function act(kind: 'png' | 'pdf' | 'share') {
    if (!svg) return
    setMessage('')
    const size: PageSize | undefined = layout === 'card' ? CARD_SIZE.phone : undefined
    if (kind === 'pdf') {
      if (layout === 'card') {
        const a4 = await cardSvg('a4')
        if (a4) download(await reportPdf(a4, CARD_SIZE.a4), `${base}.pdf`)
        return
      }
      return download(await reportPdf(svg), `${base}.pdf`)
    }
    const png = await reportPng(svg, size)
    if (kind === 'png') return download(png, `${base}.png`)
    const result = await shareFile(png, `${base}.png`, 'Growth report')
    if (result === 'unsupported') setMessage("This browser can't share files. Save the image instead and share it from your photos or files.")
  }

  return (
    <>
      <PageHeader title="Share a report" subtitle="A picture of the latest growth, made on this device. You choose what's on it, and you share the file yourself." />
      <div className="card">
        <Segmented
          legend="Layout"
          name="layout"
          value={layout}
          onChange={(v) => {
            setSvg(null)
            setLayout(v)
          }}
          options={[
            { value: 'card', label: 'Report card' },
            { value: 'simple', label: 'Simple' },
          ]}
          hint={layout === 'card' ? 'The latest numbers, four charts, gain over time and the history. The image is phone-shaped; the PDF is an A4 page.' : 'The latest numbers and the weight chart on one page.'}
        />
        <Segmented
          legend="Name on the report"
          name="name-mode"
          value={nameMode}
          onChange={setNameMode}
          options={[
            { value: 'nickname', label: child.nickname ? 'Nickname' : 'First name' },
            { value: 'name', label: 'Full name' },
            { value: 'none', label: 'No name' },
          ]}
        />
        <Checkbox checked={showBirthDate} onChange={setShowBirthDate}>
          Show the date of birth instead of the age
        </Checkbox>
        {layout === 'card' && (
          <>
            <Checkbox checked={includeHead} onChange={setIncludeHead}>
              Include head circumference
            </Checkbox>
            <Checkbox checked={includeHistory} onChange={setIncludeHistory}>
              Include the history of measurements
            </Checkbox>
            {summary && (
              <Checkbox checked={includeAi} onChange={setIncludeAi}>
                Include the latest summary in plain words (labelled as written by AI)
              </Checkbox>
            )}
          </>
        )}
      </div>

      <div className={layout === 'card' ? 'report-preview card-preview' : 'report-preview'}>
        {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Preview of the report" /> : <div className="skeleton loading-card" />}
      </div>

      <div className="row">
        <button type="button" className="button primary" onClick={() => void act('share')} disabled={!svg}>
          <Share2 size={16} aria-hidden /> Share
        </button>
        <button type="button" className="button" onClick={() => void act('png')} disabled={!svg}>
          <ImageDown size={16} aria-hidden /> Save image
        </button>
        <button type="button" className="button" onClick={() => void act('pdf')} disabled={!svg}>
          <FileDown size={16} aria-hidden /> Save PDF
        </button>
      </div>
      {message && <p role="status">{message}</p>}

      {/* Charts are drawn off-screen by the same component as the app, then copied into the report. */}
      <div ref={chartRef} className="offscreen" aria-hidden="true">
        <GrowthChart tables={tables} indicator="wfa" sex={child.sex} points={points} units={units} ageDaysNow={ageInDays(child.dateOfBirth, now)} />
      </div>
      <div ref={cardChartsRef} className="offscreen" aria-hidden="true">
        {CARD_CHARTS.map((choice) => {
          const ageNow = ageInDays(child.dateOfBirth, now)
          const { indicator, points: pts } = chartPoints(tables, child, measurements, choice, ageNow)
          return (
            <div key={choice} data-choice={choice}>
              <GrowthChart tables={tables} indicator={indicator} sex={child.sex} points={pts} units={units} ageDaysNow={ageNow} caption={false} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function shownName(child: Child, mode: NameMode): string {
  return mode === 'name' ? child.name : mode === 'nickname' ? child.nickname || child.name.split(' ')[0] : 'Growth report'
}
