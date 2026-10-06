import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { formatPercentile } from '../../growth/lms'
import { cmToIn, inToCm, kgToLbOz, lbOzToKg, parseDecimal, type Units } from '../../growth/units'
import { Trash2 } from 'lucide-react'
import { Checkbox, PageHeader, TextField } from '../../core/ui/components'
import { childPath } from '../brand'
import { useChild, useMeasurements } from '../data'
import { formatAge } from '../format'
import { growthFor, useTables } from '../growthData'
import { useSession, useStore } from '../sessionContext'
import { nowIso, today, type Child, type Measurement } from '../types'

// Plausible ranges for typing mistakes, not for judging a child: values outside are almost
// certainly a slip (a missing decimal point, the wrong unit).
const RANGES = { weightKg: [0.3, 40], statureCm: [25, 130], headCm: [18, 60] } as const

export function MeasurementForm() {
  const { id, mid } = useParams()
  const child = useChild(id)
  const measurements = useMeasurements(id)
  if (child === undefined || measurements === null) return null
  if (child === null) return <p>This child isn't in your records.</p>
  const existing = mid ? measurements.find((m) => m.id === mid) : undefined
  if (mid && !existing) return <p>This measurement isn't in your records.</p>
  return <Form key={mid ?? 'new'} child={child} existing={existing} />
}

function toText(n: number | undefined, digits = 2) {
  return n === undefined ? '' : String(Math.round(n * 10 ** digits) / 10 ** digits)
}

function Form({ child, existing }: { child: Child; existing?: Measurement }) {
  const store = useStore()
  const { app, changed, core, saveCore, mode } = useSession()
  const tables = useTables()
  const navigate = useNavigate()
  const units: Units = app.units

  const [date, setDate] = useState(existing?.date ?? today())
  const lbOz = existing?.weightKg !== undefined ? kgToLbOz(existing.weightKg) : undefined
  const [kg, setKg] = useState(toText(existing?.weightKg, 3))
  const [lb, setLb] = useState(lbOz ? String(lbOz.lb) : '')
  const [oz, setOz] = useState(lbOz ? String(lbOz.oz) : '')
  const stature = existing?.lengthCm ?? existing?.heightCm
  const [statureText, setStatureText] = useState(units === 'metric' ? toText(stature, 1) : toText(stature && cmToIn(stature), 1))
  const ageDays = date ? ageInDays(child.dateOfBirth, date) : 0
  const [standing, setStanding] = useState(existing ? existing.heightCm !== undefined : ageDays >= HEIGHT_FROM_DAY)
  const [headText, setHeadText] = useState(units === 'metric' ? toText(existing?.headCm, 1) : toText(existing?.headCm && cmToIn(existing.headCm), 1))
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // What the form currently holds, in metric. Fields left empty are undefined.
  const parsed = (() => {
    let weightKg: number | undefined
    if (units === 'metric') weightKg = kg ? parseDecimal(kg) : undefined
    else if (lb || oz) {
      const l = lb ? parseDecimal(lb) : 0
      const o = oz ? parseDecimal(oz) : 0
      weightKg = l === undefined || o === undefined ? NaN : lbOzToKg(l, o)
    }
    const len = statureText ? parseDecimal(statureText) : undefined
    const statureCm = statureText ? (len === undefined ? NaN : units === 'metric' ? len : inToCm(len)) : undefined
    const head = headText ? parseDecimal(headText) : undefined
    const headCm = headText ? (head === undefined ? NaN : units === 'metric' ? head : inToCm(head)) : undefined
    return { weightKg, statureCm, headCm }
  })()

  const preview = tables && date && ageDays >= 0
    ? growthFor(tables, child, {
        date,
        weightKg: Number.isFinite(parsed.weightKg) ? parsed.weightKg : undefined,
        lengthCm: !standing && Number.isFinite(parsed.statureCm) ? parsed.statureCm : undefined,
        heightCm: standing && Number.isFinite(parsed.statureCm) ? parsed.statureCm : undefined,
        headCm: Number.isFinite(parsed.headCm) ? parsed.headCm : undefined,
      })
    : {}

  function check(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!date) next.date = 'Enter the date.'
    else if (date > today()) next.date = "The date can't be in the future."
    else if (ageDays < 0) next.date = 'The date is before the date of birth.'
    const outOf = (v: number | undefined, [lo, hi]: readonly [number, number], name: string) => {
      if (v === undefined) return undefined
      if (Number.isNaN(v)) return `That doesn't look like a number.`
      if (v < lo || v > hi) return `That ${name} looks unusual. Check the number and the unit.`
      return undefined
    }
    const w = outOf(parsed.weightKg, RANGES.weightKg, 'weight')
    const s = outOf(parsed.statureCm, RANGES.statureCm, standing ? 'height' : 'length')
    const h = outOf(parsed.headCm, RANGES.headCm, 'head circumference')
    if (w) next.weight = w
    if (s) next.stature = s
    if (h) next.head = h
    if (parsed.weightKg === undefined && parsed.statureCm === undefined && parsed.headCm === undefined) {
      next.form = 'Enter at least one measurement.'
    }
    return next
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next = check()
    setErrors(next)
    if (Object.keys(next).length) return
    const now = nowIso()
    const m: Measurement = {
      id: existing?.id ?? crypto.randomUUID(),
      childId: child.id,
      date,
      weightKg: parsed.weightKg,
      lengthCm: standing ? undefined : parsed.statureCm,
      heightCm: standing ? parsed.statureCm : undefined,
      headCm: parsed.headCm,
      source: existing?.source ?? 'manual',
      documentId: existing?.documentId,
      visitId: existing?.visitId,
      note: note.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await store.put('measurements', m)
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    navigate(childPath(child.id))
  }

  async function remove() {
    if (!existing || !window.confirm('Delete this measurement?')) return
    await store.delete('measurements', existing.id)
    changed()
    navigate(childPath(child.id, 'measurements'))
  }

  const pct = (key: 'wfa' | 'lhfa' | 'hcfa') => {
    const z = preview[key]?.z
    return z === undefined ? undefined : `${formatPercentile(z)} percentile for age`
  }
  const lenUnit = units === 'metric' ? 'cm' : 'in'

  return (
    <>
      <PageHeader
        title={existing ? 'Edit measurement' : 'Add a measurement'}
        subtitle={date && ageDays >= 0 ? `${child.nickname || child.name} at ${formatAge(child.dateOfBirth, date)}` : undefined}
        back={{ to: childPath(child.id, existing ? 'measurements' : ''), label: existing ? 'Measurements' : 'Overview' }}
      />
      <form onSubmit={submit} noValidate className="card">
        <TextField label="Date" type="date" min={child.dateOfBirth} max={today()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />

        {units === 'metric' ? (
          <TextField label="Weight (kg)" inputMode="decimal" autoComplete="off" placeholder="e.g. 7.25" value={kg} onChange={(e) => setKg(e.target.value)} error={errors.weight} hint={pct('wfa')} />
        ) : (
          <fieldset>
            <legend>Weight</legend>
            <div className="input-row">
              <TextField label="Pounds" inputMode="decimal" value={lb} onChange={(e) => setLb(e.target.value)} />
              <TextField label="Ounces" inputMode="decimal" value={oz} onChange={(e) => setOz(e.target.value)} />
            </div>
            {errors.weight ? (
              <p className="error" role="alert">
                {errors.weight}
              </p>
            ) : (
              pct('wfa') && <p className="hint">{pct('wfa')}</p>
            )}
          </fieldset>
        )}

        <TextField
          label={`${standing ? 'Height, standing' : 'Length, lying down'} (${lenUnit})`}
          inputMode="decimal"
          autoComplete="off"
          value={statureText}
          onChange={(e) => setStatureText(e.target.value)}
          error={errors.stature}
          hint={pct('lhfa')}
        />
        <Checkbox checked={standing} onChange={setStanding}>
          Measured standing up <span className="muted">(WHO uses lying length under 2 years and standing height from 2; the charts adjust by 0.7 cm if needed)</span>
        </Checkbox>

        <TextField label={`Head circumference (${lenUnit})`} inputMode="decimal" autoComplete="off" value={headText} onChange={(e) => setHeadText(e.target.value)} error={errors.head} hint={pct('hcfa')} />
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        {errors.form && (
          <p className="error form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="row">
          <button className="button primary" type="submit">
            Save
          </button>
          {existing && (
            <button className="button ghost danger" type="button" onClick={() => void remove()}>
              <Trash2 size={16} aria-hidden /> Delete this measurement
            </button>
          )}
        </div>
      </form>
    </>
  )
}
