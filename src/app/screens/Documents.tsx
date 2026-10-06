import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { addDocument, deleteDocument, DocumentError, MAX_DOCUMENT_BYTES } from '../../core'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import { Field, Page } from '../components'
import { useChild, useDocuments } from '../data'
import { formatDate } from '../format'
import { useSession, useStore } from '../sessionContext'
import { DOCUMENT_KINDS, EXTRACTABLE, today, type BabyDocument, type DocumentKind } from '../types'

const kindLabel = (k: DocumentKind) => DOCUMENT_KINDS.find((d) => d.value === k)?.label ?? k

export function Documents() {
  const { id } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  if (child === undefined || docs === null) return null
  if (child === null) return <Page title="Not found">This child isn't in your records.</Page>
  return (
    <Page title="Documents" back={`/child/${child.id}`}>
      <p className="muted">Growth reports, health booklet pages, doctor's notes and ultrasound images, stored encrypted on this device.</p>
      <Link to={`/child/${child.id}/documents/new`} className="button primary">
        Add a document
      </Link>
      {docs.length === 0 ? (
        <p className="muted">No documents yet.</p>
      ) : (
        <ul className="measure-list">
          {docs.map((d) => (
            <li key={d.id}>
              <Link to={`/child/${child.id}/documents/${d.id}`}>
                <span>
                  <strong>{d.title}</strong> <span className="muted">· {kindLabel(d.kind)}</span>
                </span>
                <span className="muted">{formatDate(d.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

export function AddDocument() {
  const { id } = useParams()
  const child = useChild(id)
  const store = useStore()
  const { changed, core, saveCore, mode } = useSession()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<DocumentKind>('growth-report')
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!child) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file || !child) return setError('Choose a file.')
    setBusy(true)
    setError('')
    try {
      const doc = await addDocument(store, file, {
        profileId: child.id,
        date,
        kind,
        title: title.trim() || kindLabel(kind),
        meta: {},
      })
      // Each new document is a good moment for a backup reminder.
      if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 5 })
      changed()
      navigate(`/child/${child.id}/documents/${doc.id}`)
    } catch (err) {
      setError(err instanceof DocumentError ? err.message : "The file couldn't be saved.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Add a document" back={`/child/${child.id}/documents`}>
      <form onSubmit={submit} className="stack" noValidate>
        <Field label="File" htmlFor="doc-file" error={error} hint={`A PDF or a photo, up to ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`}>
          <input id="doc-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="What is it?" htmlFor="doc-kind">
          <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
            {DOCUMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor="doc-date">
          <input id="doc-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Title (optional)" htmlFor="doc-title">
          <input id="doc-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 6-month check-up" />
        </Field>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Page>
  )
}

export function DocumentPage() {
  const { id, docId } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  const store = useStore()
  const { changed } = useSession()
  const navigate = useNavigate()
  if (!child || docs === null) return null
  const doc = docs.find((d) => d.id === docId)
  if (!doc) return <Page title="Not found">This document isn't in your records.</Page>

  async function remove(d: BabyDocument) {
    if (!window.confirm(`Delete "${d.title}"? This can't be undone.`)) return
    await deleteDocument(store, d)
    changed()
    navigate(`/child/${child!.id}/documents`)
  }

  return (
    <Page title={doc.title} back={`/child/${child.id}/documents`}>
      <p className="muted">
        {kindLabel(doc.kind)} · {formatDate(doc.date)}
      </p>
      <div className="row">
        {EXTRACTABLE.has(doc.kind) && (
          <Link to={`/child/${child.id}/documents/${doc.id}/read`} className="button primary">
            Read measurements with AI
          </Link>
        )}
        {doc.kind === 'doctor-note' && (
          <Link to={`/child/${child.id}/documents/${doc.id}/summary`} className="button primary">
            Summarise with AI
          </Link>
        )}
      </div>
      {doc.kind === 'ultrasound' && <p className="hint">Ultrasound images are stored and shown only. BabyTrails never sends them to the AI or interprets them.</p>}
      <div className="doc-frame">
        <DocumentViewer store={store} doc={doc} />
      </div>
      <button type="button" className="button ghost danger" onClick={() => void remove(doc)}>
        Delete this document
      </button>
    </Page>
  )
}
