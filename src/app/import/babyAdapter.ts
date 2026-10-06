// BabyTrails' plug-in for the shared import (src/core/import): how a growth report or booklet page is
// read, what counts as already saved, and what saving creates. Doctor's notes are kept and summarised
// from their own page; ultrasound images are kept and never read.

import type { RecordStore } from '../../core'
import { AiError, askJson, imageBlock, pdfBlock, shrinkImage, type ContentBlock } from '../../core/ai/client'
import type { DocumentKindOption, ImportAdapter } from '../../core/import/adapter'
import type { StoredDoc } from '../../core/import/duplicates'
import type { IntakeFile } from '../../core/import/intake'
import type { ConfirmedRow, ProposedRow } from '../../core/review/model'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { DEMO_DOCUMENT_TITLE, DEMO_PAGE_URL, DEMO_PROPOSALS, SAMPLE_IMPORT_TITLE } from '../demo'
import { formatDate } from '../format'
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM, toProposedRows } from '../prompts/extraction'
import { counted, nowIso, type Child, type DocumentKind, type Measurement } from '../types'
import { measurementChecks } from '../checks'
import type { Tables } from '../../growth/tables'
import { measurementColumns } from './columns'
import { alreadySavedRows } from './duplicates'

/** Nothing about the whole document to keep beyond the measurements themselves. */
export type BabyMeta = Record<string, never>

export const IMPORT_KINDS: (DocumentKindOption & { value: DocumentKind })[] = [
  { value: 'growth-report', label: 'Growth report', read: true },
  { value: 'booklet', label: 'Health booklet page', read: true },
  { value: 'doctor-note', label: "Doctor's note", read: false },
  { value: 'ultrasound', label: 'Ultrasound image', read: false },
  { value: 'other', label: 'Other', read: false },
]

/**
 * A first guess at a file's kind from its name (English and Portuguese), which the user can change in
 * the queue. Anything unrecognised is taken to be a growth report.
 */
export function kindFromName(name: string): DocumentKind {
  const n = name.toLowerCase()
  if (/(^|[^a-z])(eco|ecograf|ecografia|ultrasound|ultra-sound|sonogra|scan|morfol)/.test(n)) return 'ultrasound'
  if (/(^|[^a-z])(nota|note|notes|carta|letter|relat[oó]rio|receita|prescri)/.test(n)) return 'doctor-note'
  if (/(^|[^a-z])(boletim|booklet|caderneta|bsij)/.test(n)) return 'booklet'
  return 'growth-report'
}

const readable = (kind: string) => IMPORT_KINDS.find((k) => k.value === kind)?.read ?? false
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function babyAdapter(deps: {
  store: RecordStore
  child: Child
  apiKey?: string
  model: string
  demo: boolean
  /** WHO's tables, for second looks on the review screen (src/app/checks.ts). */
  tables?: Tables | null
  onSaved: (count: number) => Promise<void> | void
}): ImportAdapter<BabyMeta> {
  const { store, child } = deps
  const mine = async () => (await store.list<Measurement>('measurements')).filter((m) => m.childId === child.id)
  // The measurements saved so far, loaded at each document's check, for the review's second looks.
  let known: Measurement[] = []

  return {
    appName: 'BabyTrails',
    documentKind: 'growth-report',
    noun: { one: 'document', many: 'documents' },
    columns: measurementColumns(child, (c) => (deps.tables ? measurementChecks(deps.tables, child, known, c) : [])),
    canRead: deps.demo || !!deps.apiKey,
    kinds: IMPORT_KINDS,
    kindFor: (file: IntakeFile) => kindFromName(file.zip ? `${file.zip}/${file.name}` : file.name),
    storeOnlyByDefault: (file: IntakeFile) => !readable(kindFromName(file.zip ? `${file.zip}/${file.name}` : file.name)),
    sample: { url: DEMO_PAGE_URL, title: SAMPLE_IMPORT_TITLE },
    sendSheet: {
      notSending: ["Your baby's name and date of birth, and their other records", "Ultrasound images and doctor's notes in this import"],
      notes: ["Growth reports and booklet pages may show your baby's name. BabyTrails can't remove text from a PDF or photo."],
    },
    estimate: ({ pdfs, images }) => ({ inputTokens: pdfs * 6000 + images * 3000, outputTokens: (pdfs + images) * 600 }),

    async read(doc: StoredDoc, bytes) {
      if (!readable(doc.kind)) throw new Error("Only growth reports and booklet pages are read. Doctor's notes are summarised from their own page.")
      let rows: ProposedRow[]
      let dropped = 0
      if (deps.demo) {
        if (doc.title !== SAMPLE_IMPORT_TITLE && doc.title !== DEMO_DOCUMENT_TITLE) throw new Error('In the demo, only the sample growth report can be read.')
        rows = DEMO_PROPOSALS
      } else {
        if (!deps.apiKey) throw new Error('Add your Anthropic API key in Settings to read documents.')
        let block: ContentBlock
        if (doc.mimeType === 'application/pdf') block = pdfBlock(bytes)
        else {
          const small = await shrinkImage(bytes, doc.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
          block = imageBlock(small.bytes, small.mediaType)
        }
        const { value } = await askJson(
          { apiKey: deps.apiKey, model: deps.model, system: EXTRACTION_SYSTEM, content: [block, { type: 'text', text: EXTRACTION_PROMPT }], maxTokens: 4000 },
          EXTRACTION_SCHEMA,
          (v) => {
            const total = Array.isArray((v as { measurements?: unknown[] })?.measurements) ? (v as { measurements: unknown[] }).measurements.length : 0
            return { rows: toProposedRows(v), total }
          },
        )
        rows = value.rows
        dropped = Math.max(0, value.total - value.rows.length)
        if (rows.length === 0 && dropped === 0) throw new AiError('output', "No measurements could be read from this document. If it's a photo, try a sharper one.")
      }
      return { rows, meta: {}, dropped }
    },

    // Measurements already saved are left out, and the rest go to review. There's deliberately no
    // "similar document" warning: a health booklet page is photographed again at every check-up with
    // new rows added, so a page that's mostly saved already is the normal case, and skipping it would
    // drop the new rows.
    async check(result) {
      const saved = await mine()
      known = counted(saved)
      return { alreadySaved: alreadySavedRows(result.rows, saved) }
    },

    async save(doc: StoredDoc, rows: ConfirmedRow[]) {
      const now = nowIso()
      const dates: string[] = []
      for (const r of rows) {
        const date = r.date as string
        const stature = r.statureCm as number | undefined
        // Lying or standing, as read; if the document didn't say, WHO's convention for the age.
        const standing = r.standing === 'yes' || (r.standing !== 'no' && ageInDays(child.dateOfBirth, date) >= HEIGHT_FROM_DAY)
        const m: Measurement = {
          id: crypto.randomUUID(),
          childId: child.id,
          date,
          weightKg: r.weightKg as number | undefined,
          lengthCm: stature !== undefined && !standing ? stature : undefined,
          heightCm: stature !== undefined && standing ? stature : undefined,
          headCm: r.headCm as number | undefined,
          source: 'extracted',
          place: 'clinic',
          documentId: doc.id,
          createdAt: now,
          updatedAt: now,
        }
        await store.put('measurements', m)
        dates.push(date)
      }
      dates.sort()
      // The document's date becomes the latest date it records, instead of the day it was imported.
      const latest = (await store.get<StoredDoc>('documents', doc.id)) ?? doc
      if (dates.length) await store.put('documents', { ...latest, date: dates.at(-1)! })
      await deps.onSaved(rows.length)
      const span = dates.length === 0 ? '' : dates[0] === dates.at(-1) ? ` on ${formatDate(dates[0])}` : `, ${formatDate(dates[0])} to ${formatDate(dates.at(-1)!)}`
      return `${plural(rows.length, 'measurement')}${span}`
    },
  }
}
