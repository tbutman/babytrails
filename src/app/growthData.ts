// Ties the app's records to the growth maths.

import { useEffect, useState } from 'react'
import { ageInDays, computeGrowth, HEIGHT_FROM_DAY, type GrowthResult } from '../growth/growth'
import type { ChartPoint } from '../growth/GrowthChart'
import { formatPercentile } from '../growth/lms'
import { loadTables, type Indicator, type Tables } from '../growth/tables'
import { formatAge, formatDate } from './format'
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

export type ChartChoice = 'wfa' | 'lhfa' | 'hcfa' | 'wfl' | 'bfa'

// The points for one chart, and the WHO indicator it uses (weight-for-height from 2 years).
export function chartPoints(tables: Tables, child: Child, measurements: Measurement[], choice: ChartChoice, ageNow: number): { indicator: Indicator; points: ChartPoint[] } {
  const indicator: Indicator = choice === 'wfl' && ageNow >= HEIGHT_FROM_DAY ? 'wfh' : choice
  const points = measurements.flatMap((m) => {
    const g = growthFor(tables, child, m)
    const label = `${formatDate(m.date)}, ${m.date === child.dateOfBirth ? 'at birth' : formatAge(child.dateOfBirth, m.date)}${m.place === 'home' ? ', at home' : ''}`
    const hollow = m.place === 'home'
    if (choice === 'wfl') {
      const r = g[indicator]
      return r && g.statureCm !== undefined ? [{ x: g.statureCm, y: r.value, label, hollow, percentile: formatPercentile(r.z) }] : []
    }
    const r = g[choice]
    return r ? [{ x: ageInDays(child.dateOfBirth, m.date), y: r.value, label, hollow, percentile: formatPercentile(r.z) }] : []
  })
  return { indicator, points }
}

/** The WHO tables in BabyTrails end at 5 years (1856 days). */
export const LAST_TABLE_DAY = 1856

/** Why some measurements aren't on a chart (BABY-11), or undefined when all of them are. */
export function notChartedNote(child: Child, measurements: Measurement[], choice: ChartChoice): string | undefined {
  const tooOld = measurements.some((m) => ageInDays(child.dateOfBirth, m.date) > LAST_TABLE_DAY)
  if (tooOld) return 'No percentile: the WHO charts in BabyTrails end at 5 years, so newer measurements are kept but not charted.'
  if (choice === 'wfl' && measurements.some((m) => m.weightKg !== undefined && m.lengthCm !== undefined && m.lengthCm < 45)) {
    return 'No weight-for-length percentile: the WHO chart starts at 45 cm.'
  }
  return undefined
}
