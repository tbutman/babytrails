// Demo mode: a fictional baby with a few months of made-up measurements, kept in memory only. The
// dates are fixed (born 20 March 2026), so the demo's booklet page (demoBooklet.json, drawn by
// scripts/make-booklet.mjs) matches the measurements saved from it.

import { MemoryStore } from '../core'
import { addDocument } from '../core'
import type { ProposedRow } from '../core/review/model'
import type { BabyDocument, Child, Measurement } from './types'
import booklet from './demoBooklet.json'

const BORN = '2026-03-20'

function daysAfter(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Day of age, weight (kg), length (cm), head circumference (cm). Fictional, but in a typical range.
const POINTS: [number, number, number | undefined, number | undefined][] = [
  [0, 3.3, 49.5, 34.0],
  [5, 3.2, undefined, undefined],
  [14, 3.75, 52.0, 35.6],
  [30, 4.35, 54.0, 36.7],
  [61, 5.3, 57.5, 38.4],
  [91, 6.05, 60.3, 39.7],
  [122, 6.6, 62.5, 40.8],
  [152, 7.1, 64.3, 41.6],
  [183, 7.5, 66.0, 42.4],
]

export const DEMO_CHILD_ID = 'demo-child'

// The demo baby and measurements, built synchronously (the landing page's preview uses them too).
export function demoData(): { child: Child; measurements: Measurement[]; born: string } {
  const born = BORN
  const createdAt = new Date().toISOString()
  const child: Child = { id: DEMO_CHILD_ID, name: 'Robin', dateOfBirth: born, sex: 'female', createdAt }
  const measurements = POINTS.map(
    ([day, weightKg, lengthCm, headCm]): Measurement => ({
      id: `demo-m${day}`,
      childId: child.id,
      date: daysAfter(born, day),
      weightKg,
      lengthCm,
      headCm,
      source: 'manual',
      place: 'clinic',
      ...(day === 0 ? { birth: true as const } : {}),
      createdAt,
      updatedAt: createdAt,
    }),
  )
  return { child, measurements, born }
}

export async function loadDemo(): Promise<MemoryStore> {
  const store = new MemoryStore()
  const { child, measurements } = demoData()
  await store.put('children', child)
  for (const m of measurements) await store.put('measurements', m)
  // A photo of a made-up booklet page (scripts/make-booklet.mjs), served with the app. Its rows are the
  // check-ups above plus one more, so reading it shows the earlier rows left out as already saved.
  try {
    const photo = await fetch(DEMO_PAGE_URL).then((r) => (r.ok ? r.blob() : Promise.reject(new Error())))
    await addDocument<BabyDocument['kind'], BabyDocument['meta']>(store, photo, {
      profileId: child.id,
      date: booklet.rows.at(-1)!.date,
      kind: 'booklet',
      title: DEMO_DOCUMENT_TITLE,
      meta: {},
    })
  } catch {
    // The demo still works without its sample document.
  }
  return store
}

// Summaries for the demo, written in advance in the style the real ones follow, from the numbers the
// app computes for the demo measurements above. No AI is called.
export const DEMO_SUMMARIES = {
  'after-data': `Your baby was last measured at **about 6 months**. Since the previous measurement 31 days earlier, weight went up by about **90 g a week**, from 7.10 kg to 7.50 kg. Length grew by 1.7 cm and head circumference by 0.8 cm.

- **Weight for age** moved from about the 60th to the 59th percentile.
- **Length for age** moved from about the 55th to the 54th percentile.
- **Head circumference** moved from about the 54th to the 56th percentile.

All three are in much the same place on the WHO charts as last time.`,
  questions: `- When should we come back for the next weight and length check?
- Is there anything you'd like us to watch for before then?
- Weight gain was about 90 g a week this month. Is that what you expected at this age?
- Which measurements will you take at the 9-month check-up?`,
}

// The demo's stored sample document, and the title the import gives the sample when it's added again.
export const DEMO_DOCUMENT_TITLE = 'Health booklet: growth page (sample)'
export const SAMPLE_IMPORT_TITLE = 'Health booklet page (sample).jpg'
export const DEMO_PAGE_URL = '/demo/booklet-page.jpg'

// The demo's "AI answer" for the booklet page, prepared in advance from the page's own rows. No
// request is made. Weights printed in grams are read as kilograms, as the extraction does.
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('/')
export const DEMO_PROPOSALS: ProposedRow[] = booklet.rows.map((r) => ({
  values: {
    date: r.cells[0].includes('.') ? r.cells[0] : ddmmyyyy(r.date),
    weightKg: r.read.weightKg,
    statureCm: 'statureCm' in r.read ? r.read.statureCm : undefined,
    standing: 'statureCm' in r.read ? 'no' : undefined,
    headCm: 'headCm' in r.read ? r.read.headCm : undefined,
  },
  confidence: (('confidence' in r ? r.confidence : 'high') as ProposedRow['confidence']),
  sourceText: r.source,
  page: 1,
}))
