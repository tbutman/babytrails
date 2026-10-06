// Saved AI summaries: labels, and hooks for the latest one and whether it's out of date.

import { useEffect, useState } from 'react'
import { useCollection, useMeasurements } from './data'
import { buildFacts, factsDigest } from './facts'
import { useTables } from './growthData'
import { today, type Child, type Summary } from './types'

export const SUMMARY_LABELS: Record<Summary['kind'], string> = {
  'after-data': 'What changed',
  questions: 'Questions for the next check-up',
  document: 'A summary of what this document says',
}

export function useSummaries(childId: string | undefined) {
  const all = useCollection<Summary>('summaries')
  return all?.filter((s) => s.childId === childId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) ?? null
}

// The latest saved summary of a kind, and whether the data has changed since.
export function useLatestSummary(child: Child | null | undefined, kind: 'after-data' | 'questions') {
  const summaries = useSummaries(child?.id)
  const measurements = useMeasurements(child?.id)
  const tables = useTables()
  const [digest, setDigest] = useState<string | null>(null)
  useEffect(() => {
    if (!child || !measurements || !tables) return
    const facts = buildFacts(tables, child, measurements, today())
    if (facts) void factsDigest({ ...facts, baby: { ...facts.baby, ageDaysToday: 0 } }).then(setDigest)
  }, [child, measurements, tables])
  const latest = summaries?.find((s) => s.kind === kind)
  return { summary: latest, stale: !!latest && !!digest && latest.inputsDigest !== digest }
}

