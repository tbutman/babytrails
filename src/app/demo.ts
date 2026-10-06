// Demo mode: a fictional baby with a few months of made-up measurements, kept in memory only.
// Dates are relative to today, so the demo always shows a baby of about six and a half months.

import { MemoryStore } from '../core'
import { addDocument } from '../core'
import type { ProposedRow } from '../core/review/model'
import type { BabyDocument, Child, Measurement } from './types'
import { today } from './types'

const DEMO_AGE_DAYS = 200

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const now = today()
  const born = daysBefore(now, DEMO_AGE_DAYS)
  const createdAt = new Date().toISOString()
  const child: Child = { id: DEMO_CHILD_ID, name: 'Robin', dateOfBirth: born, sex: 'female', createdAt }
  const measurements = POINTS.map(
    ([day, weightKg, lengthCm, headCm]): Measurement => ({
      id: `demo-m${day}`,
      childId: child.id,
      date: daysBefore(now, DEMO_AGE_DAYS - day),
      weightKg,
      lengthCm,
      headCm,
      source: 'manual',
      createdAt,
      updatedAt: createdAt,
    }),
  )
  return { child, measurements, born }
}

export async function loadDemo(): Promise<MemoryStore> {
  const store = new MemoryStore()
  const now = today()
  const { child, measurements } = demoData()
  await store.put('children', child)
  for (const m of measurements) await store.put('measurements', m)
  // A made-up growth report (scripts/make-sample-pdf.mjs), served with the app.
  try {
    const pdf = await fetch('/demo/sample-growth-report.pdf').then((r) => (r.ok ? r.blob() : Promise.reject(new Error())))
    await addDocument<BabyDocument["kind"], BabyDocument["meta"]>(store, pdf, {
      profileId: child.id,
      date: daysBefore(now, DEMO_AGE_DAYS - 183),
      kind: 'growth-report',
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
export const SAMPLE_IMPORT_TITLE = 'Sample growth report (fictional).pdf'

// The demo's "AI answer" for the sample growth report, prepared in advance. No request is made.
export const DEMO_PROPOSALS: ProposedRow[] = [
  { values: { date: '15/07/2026', weightKg: 6.05, statureCm: 60.3, standing: 'no', headCm: 39.7 }, confidence: 'high', sourceText: '15/07/2026 6,05 kg 60,3 cm 39,7 cm', page: 1 },
  { values: { date: '14/08/2026', weightKg: 6.6, statureCm: 62.5, standing: 'no', headCm: 40.8 }, confidence: 'high', sourceText: '14/08/2026 6,60 kg 62,5 cm 40,8 cm', page: 1 },
  { values: { date: '15/09/2026', weightKg: 7.1, statureCm: 64.3, standing: 'no', headCm: 41.6 }, confidence: 'medium', sourceText: '15/09/2026 7,10 kg 64,3 cm 41,6 cm', page: 1 },
]
