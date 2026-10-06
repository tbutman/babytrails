// Demo mode: a fictional baby with a few months of made-up measurements, kept in memory only.
// Dates are relative to today, so the demo always shows a baby of about six and a half months.

import { MemoryStore } from '../core'
import type { Child, Measurement } from './types'
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

export async function loadDemo(): Promise<MemoryStore> {
  const store = new MemoryStore()
  const now = today()
  const born = daysBefore(now, DEMO_AGE_DAYS)
  const createdAt = new Date().toISOString()
  const child: Child = { id: DEMO_CHILD_ID, name: 'Robin', dateOfBirth: born, sex: 'female', createdAt }
  await store.put('children', child)
  for (const [day, weightKg, lengthCm, headCm] of POINTS) {
    const date = daysBefore(now, DEMO_AGE_DAYS - day)
    const m: Measurement = {
      id: `demo-m${day}`,
      childId: child.id,
      date,
      weightKg,
      lengthCm,
      headCm,
      source: 'manual',
      createdAt,
      updatedAt: createdAt,
    }
    await store.put('measurements', m)
  }
  return store
}
