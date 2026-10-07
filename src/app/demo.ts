// Demo mode: a fictional baby with a few months of made-up measurements, kept in memory only. The
// dates are fixed (born 20 March 2026), so the demo's booklet page (demoBooklet.json, drawn by
// scripts/make-booklet.mjs) matches the measurements saved from it.

import { MemoryStore } from '../core'
import { addDocument } from '../core'
import type { Answer } from '../core/ask/model'
import type { ProposedRow } from '../core/review/model'
import type { BabyDocument } from './types'
import { demoData } from './demoData'
import booklet from './demoBooklet.json'

export { DEMO_CHILD_ID, demoData } from './demoData'

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

// "Ask about the numbers" in the demo: answers to the suggested questions, prepared in advance from
// the demo baby's facts, with the numbers they use declared like a real answer's (a test checks them).
// No AI is called.
export const DEMO_ANSWERS: Record<string, Answer> = {
  gain: {
    kind: 'answer',
    text: `Over the 31 days to the latest check-up, your baby's weight went up by **90 g a week**. Staying on exactly the same weight-for-age percentile over those days would have meant about **95 g a week**, so the gain was about the same as the one that keeps the same line: weight moved from about the 60th to the **59th percentile**. Against WHO's own standards for weight gain from 5 to 6 months, it's about the **50th percentile**.

Weekly gain has been getting smaller month by month, from **262 g a week** at 2 to 4 weeks old to 90 g a week now, and at each step it stayed close to its same-line reference. Gains slowing down over the first months is what the curves on the chart show too.

Your pediatrician can tell you how this fits with everything else they see at the check-up.`,
    numbers: [
      { text: '90 g a week', fact: 'gains.weight[5].perWeekGrams' },
      { text: '95 g a week', fact: 'gains.weight[5].sameLinePerWeekGrams' },
      { text: '60th', fact: 'change.percentileMoves[0].fromPercentile' },
      { text: '59th percentile', fact: 'change.percentileMoves[0].toPercentile' },
      { text: '262 g a week', fact: 'gains.weight[0].perWeekGrams' },
      { text: '50th percentile', fact: 'gains.weight[5].whoGainPercentile' },
    ],
  },
  percentile: {
    kind: 'answer',
    text: `Your baby's latest weight, **7.5 kg** at about 6 months, is on the **59th percentile** for weight for age. Out of 100 babies of the same age and sex in the WHO reference, about 59 would weigh less.

A percentile isn't a score, and higher isn't better. The chart's lines at the 3rd, 15th, 50th, 85th and **97th percentile** show where most babies sit. What usually tells you more is how a baby's measurements move over time: your baby's weight has stayed close to the same line since the check-up before.`,
    numbers: [
      { text: '7.5 kg', fact: 'latest.weightKg' },
      { text: '59th percentile', fact: 'latest.scores.wfa.percentile' },
      { text: '97th percentile', fact: 'references.whoChartPercentileLines[4]' },
    ],
  },
  length: {
    kind: 'answer',
    text: `Length has gone up at every check-up, a little more slowly each month: from **1.8 cm a month** between 4 and 5 months old to **1.7 cm a month** over the last month. Staying on the same length-for-age line over the last month would have meant about **1.7 cm a month**, so length kept to its line: it's on the **54th percentile** now, and was on the **55th percentile** at the check-up before.

Measuring a baby's length is tricky, and two measurements can differ by about a centimeter, so one check-up on its own says less than the trend.`,
    numbers: [
      { text: '1.8 cm a month', fact: 'gains.length[4].perMonthCm' },
      { text: '1.7 cm a month', fact: 'gains.length[5].perMonthCm' },
      { text: '1.7 cm a month', fact: 'gains.length[5].sameLinePerMonthCm' },
      { text: '54th percentile', fact: 'latest.scores.lhfa.percentile' },
      { text: '55th percentile', fact: 'previous.scores.lhfa.percentile' },
    ],
  },
}
