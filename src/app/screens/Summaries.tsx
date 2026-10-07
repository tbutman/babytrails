// AI summaries: after new data, questions for the next check-up, and a summary of a document.
// Every one goes through the "what will be sent" sheet, and is saved with a digest of its inputs so
// the app can say when it's out of date.

import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { documentBytes } from '../../core'
import { AiError, askText, imageBlock, pdfBlock, PHOTO_NOTE, shrinkImage } from '../../core/ai/client'
import { bannedPhrase, summaryWordingError, UNCHECKED_NUMBERS_NOTE } from '../../core/ask/wording'
import { demoNote } from '../../core/ui/copy'
import { Markdown } from '../../core/ai/Markdown'
import { redactNames } from '../../core/ai/redact'
import { AiOutput, SendSheet } from '../../core/ai/SendSheet'
import { PageHeader } from '../../core/ui/components'
import { APP, childPath } from '../brand'
import { useChild, useDocuments, useCountedMeasurements } from '../data'
import { SUMMARY_LABELS, useLatestSummary, useSummaries } from '../summaries'
import { buildFacts, factsDigest, sentFacts, type Facts } from '../facts'
import { formatDate } from '../format'
import { useTables } from '../growthData'
import { AFTER_DATA_SYSTEM, DOCUMENT_SUMMARY_SYSTEM, QUESTIONS_SYSTEM, factsMessage } from '../prompts/summaries'
import { useSession, useStore } from '../sessionContext'
import { DEMO_SUMMARIES } from '../demo'
import { nowIso, today, type BabyDocument, type Child, type Summary } from '../types'

export function SummaryCard({ child, kind }: { child: Child; kind: 'after-data' | 'questions' }) {
  const { summary, stale } = useLatestSummary(child, kind)
  if (!summary) return null
  return (
    <AiOutput label={SUMMARY_LABELS[kind]} note={summary.model === 'prepared in advance' ? demoNote('baby') : undefined}>
      <Markdown text={summary.text} />
      <p className="hint">{UNCHECKED_NUMBERS_NOTE}</p>
      <p className="hint">
        {formatDate(summary.createdAt.slice(0, 10))}
        {stale && ' · Written before your latest changes.'}
      </p>
    </AiOutput>
  )
}

export function GrowthSummary() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const kind = params.get('kind') === 'questions' ? 'questions' : 'after-data'
  const child = useChild(id)
  const measurements = useCountedMeasurements(id)
  const tables = useTables()
  const store = useStore()
  const { core, mode, changed } = useSession()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!child || !measurements || !tables) return null

  const facts = buildFacts(tables, child, measurements, today())
  const back = childPath(child.id)
  const title = kind === 'questions' ? 'Questions for the next check-up' : 'Explain the latest changes'

  if (!facts) {
    return (
      <>
        <PageHeader title={title} back={{ to: back, label: 'Overview' }} />
        <p>Add a measurement first.</p>
      </>
    )
  }

  async function save(text: string, model: string, f: Facts) {
    const summary: Summary = {
      id: crypto.randomUUID(),
      childId: child!.id,
      kind,
      model,
      createdAt: nowIso(),
      text,
      inputsDigest: await factsDigest({ ...f, baby: { ...f.baby, ageDaysToday: 0 } }),
    }
    await store.put('summaries', summary)
    changed()
    navigate(back)
  }

  if (mode === 'demo') {
    return (
      <>
        <PageHeader title={title} back={{ to: back, label: 'Overview' }} />
        <p className="callout">Demo: this summary was written in advance for the made-up baby. No AI is called in the demo.</p>
        <button type="button" className="button primary" onClick={() => void save(DEMO_SUMMARIES[kind], 'prepared in advance', facts)}>
          Show it
        </button>
      </>
    )
  }

  if (!core.ai.apiKey) {
    return (
      <>
        <PageHeader title={title} back={{ to: back, label: 'Overview' }} />
        <p>Summaries use AI with your own Anthropic API key. Add one in Settings first.</p>
        <Link to={`${APP}/settings#ai`} className="button primary">
          Go to Settings
        </Link>
      </>
    )
  }

  async function send() {
    setBusy(true)
    setError('')
    try {
      const text = redactNames(factsMessage(sentFacts(facts!)), [child!.name, child!.nickname], 'your baby')
      const { text: answer } = await askText({
        apiKey: core.ai.apiKey!,
        model: core.ai.model,
        system: kind === 'questions' ? QUESTIONS_SYSTEM : AFTER_DATA_SYSTEM,
        content: [{ type: 'text', text }],
        maxTokens: 800,
      })
      // The same wording rules as Ask (CORE-04): a summary that judges or reassures isn't saved.
      if (bannedPhrase(answer)) return setError(summaryWordingError('BabyTrails'))
      await save(answer, core.ai.model, facts!)
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
        <PageHeader title={title} back={{ to: back, label: 'Overview' }} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <SendSheet
        appName="BabyTrails"
        sending={[
          `Your baby's sex and age in days`,
          `The latest${facts.previous ? ' two measurements' : ' measurement'}, with the percentiles and changes BabyTrails calculated`,
          ...(Object.values(facts.gains).some((g) => g?.length) ? ['Gains between your recent measurements (ages in days and rates)'] : []),
        ]}
        notSending={["Your baby's name and date of birth", 'The dates of the measurements', 'Your documents and notes']}
        model={core.ai.model}
        estimate={{ inputTokens: 2000, outputTokens: 400 }}
        busy={busy}
        onSend={() => void send()}
        onCancel={() => navigate(back)}
      />
    </>
  )
}

export function DocumentSummary() {
  const { id, docId } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  const summaries = useSummaries(id)
  const store = useStore()
  const { core, mode, changed } = useSession()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!child || docs === null || summaries === null) return null
  const doc = docs.find((d) => d.id === docId)
  if (!doc) return <p>This document isn't in your records.</p>
  const back = childPath(child.id, `documents/${doc.id}`)
  const existing = summaries.find((s) => s.kind === 'document' && s.documentId === doc.id)

  if (existing) {
    return (
      <>
        <PageHeader title={doc.title} back={{ to: back, label: 'Document' }} />
        <AiOutput label={SUMMARY_LABELS.document}>
          <Markdown text={existing.text} />
          <p className="hint">Numbers in this summary weren't checked by the app; check them against the document.</p>
        </AiOutput>
      </>
    )
  }
  // Only doctor's notes are summarized; an ultrasound or a growth report can't be sent from a typed
  // address (BABY-20).
  if (doc.kind !== 'doctor-note') {
    return (
      <>
        <PageHeader title={doc.title} back={{ to: back, label: 'Document' }} />
        <p>Only doctor's notes can be summarized. Growth reports and booklet pages are read into measurements instead, and ultrasound images are never sent.</p>
      </>
    )
  }
  if (mode === 'demo' || !core.ai.apiKey) {
    return (
      <>
        <PageHeader title="Summarize this document" back={{ to: back, label: 'Document' }} />
        <p>{mode === 'demo' ? "The demo doesn't call the AI." : 'Summaries use AI with your own Anthropic API key. Add one in Settings first.'}</p>
        {mode !== 'demo' && (
          <Link to={`${APP}/settings#ai`} className="button primary">
            Go to Settings
          </Link>
        )}
      </>
    )
  }

  async function send(d: BabyDocument) {
    setBusy(true)
    setError('')
    try {
      const bytes = await documentBytes(store, d)
      const block = d.mimeType === 'application/pdf' ? pdfBlock(bytes) : await shrinkImage(bytes, d.mimeType).then((s) => imageBlock(s.bytes, s.mediaType))
      const { text } = await askText({
        apiKey: core.ai.apiKey!,
        model: core.ai.model,
        system: DOCUMENT_SUMMARY_SYSTEM,
        content: [block, { type: 'text', text: 'Summarize this document, following the rules.' }],
        maxTokens: 1000,
      })
      // A document's own words may be quoted ("normal development"); the summary's own voice may not judge.
      if (bannedPhrase(text, [], { allowQuoted: true })) return setError(summaryWordingError('BabyTrails'))
      const summary: Summary = { id: crypto.randomUUID(), childId: child!.id, kind: 'document', documentId: d.id, model: core.ai.model, createdAt: nowIso(), text, inputsDigest: d.id }
      await store.put('summaries', summary)
      changed()
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const kb = Math.max(1, Math.round(doc.bytes / 1024))
  return (
    <>
        <PageHeader title="Summarize this document" back={{ to: back, label: 'Document' }} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <SendSheet
        appName="BabyTrails"
        sending={[`This document: "${doc.title}" (${doc.mimeType === 'application/pdf' ? 'PDF' : 'photo'}, ${kb} kB)`]}
        notSending={["Your baby's other records"]}
        notes={[
          "The document itself may show your baby's name. BabyTrails can't remove text from a PDF or photo.",
          ...(doc.mimeType === 'application/pdf' ? [] : [PHOTO_NOTE]),
        ]}
        model={core.ai.model}
        estimate={{ inputTokens: 5000, outputTokens: 400 }}
        busy={busy}
        onSend={() => void send(doc)}
        onCancel={() => navigate(back)}
      />
    </>
  )
}

