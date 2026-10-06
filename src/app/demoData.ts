// The demo baby and her made-up measurements, with no dependencies on the vault or the store, so the
// landing page's preview can use them without loading either. Dates are fixed (born 20 March 2026),
// so the demo's booklet page matches them (demo.ts).

import type { Child, Measurement } from './types'

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
