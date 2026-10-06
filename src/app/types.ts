// BabyTrails' own record types. They live in app collections in the encrypted store; the core
// doesn't know about them.

import type { Sex } from '../growth/tables'
import type { Units } from '../growth/units'
import type { DocumentRecord } from '../core'

export const APP_ID = 'babytrails'
export const APP_COLLECTIONS = ['children', 'measurements', 'visits', 'summaries', 'askThreads'] as const

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
  /** Measured at birth (entered from the child's page). */
  birth?: true
  /** Where it was measured. Read from a document: clinic. */
  place?: Place
  /** Left out of charts, gains, summaries and reports, but kept. */
  excluded?: boolean
  excludedReason?: string
  createdAt: string
  updatedAt: string
}

/** The measurements that count for charts, gains, summaries and reports: everything not left out. */
export const counted = (ms: Measurement[]) => ms.filter((m) => !m.excluded)

export type Place = 'clinic' | 'home' | 'other'
export const PLACES: { value: Place; label: string }[] = [
  { value: 'clinic', label: 'Clinic' },
  { value: 'home', label: 'Home' },
  { value: 'other', label: 'Other' },
]

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

export type DocumentKind = 'growth-report' | 'booklet' | 'doctor-note' | 'ultrasound' | 'other'
export type BabyDocument = DocumentRecord<DocumentKind, { visitId?: string }>

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'growth-report', label: 'Growth report' },
  { value: 'booklet', label: 'Health booklet page' },
  { value: 'doctor-note', label: "Doctor's note" },
  { value: 'ultrasound', label: 'Ultrasound image' },
  { value: 'other', label: 'Other' },
]

// Kinds the AI can read measurements from. Ultrasound images are stored and shown, never sent.
export const EXTRACTABLE: ReadonlySet<DocumentKind> = new Set(['growth-report', 'booklet'])

export type AppSettings = { units: Units; lastPlace?: Place }
export const DEFAULT_APP_SETTINGS: AppSettings = { units: 'metric' }

// Today's date where the user is, as YYYY-MM-DD.
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const nowIso = () => new Date().toISOString()
