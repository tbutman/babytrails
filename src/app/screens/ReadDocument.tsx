// Reading measurements from a document: send it (after the user agrees), review what came back,
// and save only what the user confirms.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { documentBytes } from '../../core'
import { AiError, askJson, imageBlock, pdfBlock, shrinkImage } from '../../core/ai/client'
import { SendSheet } from '../../core/ai/SendSheet'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import { ReviewPanel } from '../../core/review/ReviewPanel'
import type { Column, ConfirmedRow, ProposedRow } from '../../core/review/model'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { Disclaimer } from '../components'
import { PageHeader } from '../../core/ui/components'
import { APP, childPath } from '../brand'
import { useChild, useDocuments } from '../data'
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM, toProposedRows } from '../prompts/extraction'
import { useSession, useStore } from '../sessionContext'
import { nowIso, today, type BabyDocument, type Child, type Measurement } from '../types'

const range = (lo: number, hi: number, what: string) => (v: string) =>
  Number(v) < lo || Number(v) > hi ? `That ${what} looks unusual. Check it against the document.` : undefined

function columnsFor(child: Child): Column[] {
  return [
    {
      key: 'date',
      label: 'Date',
      type: 'date',
      required: true,
      validate: (v) => (v < child.dateOfBirth ? 'Before the date of birth.' : v > today() ? 'In the future.' : undefined),
    },
    { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', validate: range(0.3, 40, 'weight') },
    { key: 'statureCm', label: 'Length or height', unit: 'cm', type: 'number', validate: range(25, 130, 'length') },
    {
      key: 'standing',
      label: 'Measured',
      type: 'choice',
      options: [
        { value: 'no', label: 'Lying down' },
        { value: 'yes', label: 'Standing' },
      ],
    },
    { key: 'headCm', label: 'Head', unit: 'cm', type: 'number', validate: range(18, 60, 'head circumference') },
  ]
}

// The demo's "AI answer", prepared in advance from the sample PDF. No request is made in the demo.
const DEMO_PROPOSALS: ProposedRow[] = [
  { values: { date: '15/07/2026', weightKg: 6.05, statureCm: 60.3, standing: 'no', headCm: 39.7 }, confidence: 'high', sourceText: '15/07/2026 6,05 kg 60,3 cm 39,7 cm', page: 1 },
  { values: { date: '14/08/2026', weightKg: 6.6, statureCm: 62.5, standing: 'no', headCm: 40.8 }, confidence: 'high', sourceText: '14/08/2026 6,60 kg 62,5 cm 40,8 cm', page: 1 },
  { values: { date: '15/09/2026', weightKg: 7.1, statureCm: 64.3, standing: 'no', headCm: 41.6 }, confidence: 'medium', sourceText: '15/09/2026 7,10 kg 64,3 cm 41,6 cm', page: 1 },
]

export function ReadDocument() {
  const { id, docId } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  if (!child || docs === null) return null
  const doc = docs.find((d) => d.id === docId)
  if (!doc) return <p>This document isn't in your records.</p>
  return <Reader child={child} doc={doc} />
}

function Reader({ child, doc }: { child: Child; doc: BabyDocument }) {
  const store = useStore()
  const { core, mode, changed, saveCore } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState<'ask' | 'sending' | 'review'>('ask')
  const [proposed, setProposed] = useState<ProposedRow[]>([])
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const demo = mode === 'demo'
  const apiKey = core.ai.apiKey

  async function send() {
    if (!apiKey) return
    setStep('sending')
    setError('')
    try {
      const bytes = await documentBytes(store, doc)
      let block
      if (doc.mimeType === 'application/pdf') block = pdfBlock(bytes)
      else {
        const small = await shrinkImage(bytes, doc.mimeType)
        block = imageBlock(small.bytes, small.mediaType)
      }
      const { value } = await askJson(
        { apiKey, model: core.ai.model, system: EXTRACTION_SYSTEM, content: [block, { type: 'text', text: EXTRACTION_PROMPT }], maxTokens: 4000 },
        EXTRACTION_SCHEMA,
        toProposedRows,
      )
      setProposed(value)
      setStep('review')
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong.')
      setStep('ask')
    }
  }

  async function save(rows: ConfirmedRow[]) {
    const now = nowIso()
    for (const r of rows) {
      const date = r.date as string
      const stature = r.statureCm as number | undefined
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
        documentId: doc.id,
        createdAt: now,
        updatedAt: now,
      }
      await store.put('measurements', m)
    }
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + rows.length })
    changed()
    navigate(childPath(child.id))
  }

  if (step === 'review') {
    return (
      <>
        <PageHeader title="Check the values" back={{ to: childPath(child.id, `documents/${doc.id}`), label: 'Document' }} />
        <p>
          Compare each value with the document. Tick the ones that match, fix any that don't, and remove anything wrong. Only ticked
          values are saved.
        </p>
        {demo && <p className="callout">Demo: these values were prepared in advance from the sample document. No AI was called.</p>}
        <ReviewPanel
          columns={columnsFor(child)}
          proposed={proposed}
          source={(p) => <DocumentViewer store={store} doc={doc} page={p ?? page} onPageChange={setPage} />}
          onConfirm={save}
          onCancel={() => navigate(childPath(child.id, `documents/${doc.id}`))}
          confirmLabel={(n) => `Save ${n} confirmed measurement${n === 1 ? '' : 's'}`}
        />
        <Disclaimer />
      </>
    )
  }

  if (demo) {
    return (
      <>
        <PageHeader title="Read measurements" back={{ to: childPath(child.id, `documents/${doc.id}`), label: 'Document' }} />
        <p>
          With your own Anthropic API key, BabyTrails sends the document to Anthropic, which proposes the measurements it can read. You then
          check every value before anything is saved.
        </p>
        <p className="callout">In the demo, no AI is called: you'll see values prepared in advance from the sample document.</p>
        <button
          type="button"
          className="button primary"
          onClick={() => {
            setProposed(DEMO_PROPOSALS)
            setStep('review')
          }}
        >
          Show the review step
        </button>
      </>
    )
  }

  if (!apiKey) {
    return (
      <>
        <PageHeader title="Read measurements" back={{ to: childPath(child.id, `documents/${doc.id}`), label: 'Document' }} />
        <p>Reading documents uses AI with your own Anthropic API key. Add one in Settings first.</p>
        <Link to={`${APP}/settings#ai`} className="button primary">
          Go to Settings
        </Link>
      </>
    )
  }

  const kb = Math.max(1, Math.round(doc.bytes / 1024))
  return (
    <>
        <PageHeader title="Read measurements" back={{ to: childPath(child.id, `documents/${doc.id}`), label: 'Document' }} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <SendSheet
        appName="BabyTrails"
        sending={[`This document: "${doc.title}" (${doc.mimeType === 'application/pdf' ? 'PDF' : 'photo'}, ${kb} kB)`, 'Instructions to copy the measurements printed in it']}
        notSending={["Your baby's name, date of birth and other records"]}
        notes={["The document itself may show your baby's name. BabyTrails can't remove text from a PDF or photo."]}
        model={core.ai.model}
        estimate={{ inputTokens: doc.mimeType === 'application/pdf' ? 6000 : 3000, outputTokens: 600 }}
        busy={step === 'sending'}
        onSend={() => void send()}
        onCancel={() => navigate(childPath(child.id, `documents/${doc.id}`))}
      />
    </>
  )
}
