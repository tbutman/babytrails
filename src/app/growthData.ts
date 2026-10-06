// Ties the app's records to the growth maths.

import { useEffect, useState } from 'react'
import { ageInDays, computeGrowth, type GrowthResult } from '../growth/growth'
import { loadTables, type Tables } from '../growth/tables'
import type { Child, Measurement } from './types'

export function useTables(): Tables | null {
  const [tables, setTables] = useState<Tables | null>(null)
  useEffect(() => {
    void loadTables().then(setTables)
  }, [])
  return tables
}

export function growthFor(tables: Tables, child: Child, m: Pick<Measurement, 'date' | 'weightKg' | 'lengthCm' | 'heightCm' | 'headCm'>): GrowthResult {
  return computeGrowth(tables, {
    ageDays: ageInDays(child.dateOfBirth, m.date),
    sex: child.sex,
    weightKg: m.weightKg,
    lengthCm: m.lengthCm,
    heightCm: m.heightCm,
    headCm: m.headCm,
  })
}

// Weight change per week between the two most recent weighings, computed by the code.
export function weeklyGain(measurements: Measurement[]): { kgPerWeek: number; days: number; from: Measurement; to: Measurement } | null {
  const weighed = measurements.filter((m) => m.weightKg !== undefined)
  if (weighed.length < 2) return null
  const [from, to] = weighed.slice(-2)
  const days = ageInDays(from.date, to.date)
  if (days <= 0) return null
  return { kgPerWeek: ((to.weightKg! - from.weightKg!) / days) * 7, days, from, to }
}
