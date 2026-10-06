// What "already saved" means for a growth report: a row whose date has a saved measurement with the
// same values. Checked when a document comes up for review, so a report imported twice, or two files
// of the same booklet page, don't create the same measurements again.

import { detectDateOrder, normaliseNumber, parseDate, type ProposedRow } from '../../core/review/model'
import type { Measurement } from '../types'

// Values are compared after rounding the way they're shown: weight to 10 g, lengths to 1 mm.
const same = (a: number | undefined, b: number | undefined, tolerance: number) => a !== undefined && b !== undefined && Math.abs(a - b) <= tolerance
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(normaliseNumber(String(v)))
  return Number.isFinite(n) ? n : undefined
}

/** The ISO date of each row, using the order the document's own dates reveal; undefined if it can't tell. */
export function rowDates(rows: ProposedRow[]): (string | undefined)[] {
  const raws = rows.map((r) => String(r.values.date ?? ''))
  const order = detectDateOrder(raws)
  return raws.map((raw) => parseDate(raw, order))
}

export function alreadySavedRows(rows: ProposedRow[], measurements: Measurement[]): ProposedRow[] {
  const dates = rowDates(rows)
  return rows.filter((row, i) => {
    const date = dates[i]
    if (!date) return false
    const weight = num(row.values.weightKg)
    const stature = num(row.values.statureCm)
    const head = num(row.values.headCm)
    if (weight === undefined && stature === undefined && head === undefined) return false
    return measurements.some(
      (m) =>
        m.date === date &&
        (weight === undefined || same(weight, m.weightKg, 0.005)) &&
        (stature === undefined || same(stature, m.lengthCm ?? m.heightCm, 0.05)) &&
        (head === undefined || same(head, m.headCm, 0.05)),
    )
  })
}
