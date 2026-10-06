// BabyTrails' own record types. They live in app collections in the encrypted store; the core
// doesn't know about them.

import type { Sex } from '../growth/tables'
import type { Units } from '../growth/units'

export const APP_ID = 'babytrails'
export const APP_COLLECTIONS = ['children', 'measurements', 'visits', 'summaries'] as const

export type Child = {
  id: string
  name: string
  nickname?: string
  dateOfBirth: string
  sex: Sex
  gestationalAge?: { weeks: number; days: number }
  photoBlobId?: string
  createdAt: string
}

export type Measurement = {
  id: string
  childId: string
  date: string
  weightKg?: number
  lengthCm?: number
  heightCm?: number
  headCm?: number
  source: 'manual' | 'extracted'
  documentId?: string
  visitId?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export type Visit = { id: string; childId: string; date: string; place?: string; clinician?: string; note?: string }

export type Summary = {
  id: string
  childId: string
  kind: 'after-data' | 'document' | 'questions'
  documentId?: string
  model: string
  createdAt: string
  text: string
  inputsDigest: string
}

export type AppSettings = { units: Units }
export const DEFAULT_APP_SETTINGS: AppSettings = { units: 'metric' }

// Today's date where the user is, as YYYY-MM-DD.
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const nowIso = () => new Date().toISOString()
