import { ChevronRight, FileHeart, FileImage, FileText, FileUp, Plus, ScanText, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { addDocument, deleteDocument, DocumentError, MAX_DOCUMENT_BYTES } from '../../core'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import { Callout, EmptyState, FileDrop, PageHeader, SelectField, TextField } from '../../core/ui/components'
import { childPath } from '../brand'
import { useChild, useDocuments } from '../data'
import { formatDate } from '../format'
import { useSession, useStore } from '../sessionContext'
import { DOCUMENT_KINDS, EXTRACTABLE, today, type BabyDocument, type DocumentKind } from '../types'

const kindLabel = (k: DocumentKind) => DOCUMENT_KINDS.find((d) => d.value === k)?.label ?? k
const kindIcon = (d: BabyDocument) => (d.kind === 'ultrasound' ? FileHeart : d.mimeType === 'application/pdf' ? FileText : FileImage)

export function Documents() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  if (!child || docs === null) return null
  const add = (
    <Link className="button primary" to={childPath(child.id, 'documents/new')}>
      <Plus size={16} aria-hidden /> Add a document
    </Link>
  )
  return (
    <>
      <PageHeader title="Documents" subtitle="Growth reports, booklet pages, doctor's notes and ultrasound images, encrypted on this device" actions={docs.length > 0 && add} />
      {docs.length === 0 ? (
        <EmptyState icon={FileUp} title="No documents yet" action={add}>
          Add a PDF or a photo. BabyTrails can read the measurements in a growth report for you to check.
        </EmptyState>
      ) : (
        <div className="card padless list">
          {docs.map((d) => {
            const Icon = kindIcon(d)
            return (
              <Link key={d.id} to={childPath(child.id, `documents/${d.id}`)} className="list-row">
                <Icon size={20} aria-hidden />
                <span className="list-row-main">
                  <span className="list-row-title">{d.title}</span>
                  <span className="list-row-sub">
                    {kindLabel(d.kind)} · {formatDate(d.date)}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

export function AddDocument() {
  const { id = '' } = useParams()
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
      const doc = await addDocument(store, file, { profileId: child.id, date, kind, title: title.trim() || kindLabel(kind), meta: {} })
      // Each new document is a good moment for a backup reminder.
      if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 5 })
      changed()
      navigate(childPath(child.id, `documents/${doc.id}`))
    } catch (err) {
      setError(err instanceof DocumentError ? err.message : "The file couldn't be saved.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Add a document" back={{ to: childPath(child.id, 'documents'), label: 'Documents' }} />
      <form onSubmit={submit} className="card" noValidate>
        <FileDrop
          label={file ? file.name : 'Choose a PDF or a photo'}
          hint={`Or drop it here. Up to ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`}
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          icon={FileUp}
          onFile={setFile}
        />
        {error && (
          <p className="error form-error" role="alert">
            {error}
          </p>
        )}
        <SelectField label="What is it?" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
          {DOCUMENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </SelectField>
        <div className="input-row">
          <TextField label="Date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 6-month check-up" />
        </div>
        <button className="button primary" type="submit" disabled={busy || !file}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </>
  )
}

export function DocumentPage() {
  const { id = '', docId } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  const store = useStore()
  const { changed } = useSession()
  const navigate = useNavigate()
  if (!child || docs === null) return null
  const doc = docs.find((d) => d.id === docId)
  if (!doc) return <p>This document isn't in your records.</p>

  async function remove(d: BabyDocument) {
    if (!window.confirm(`Delete "${d.title}"? This can't be undone.`)) return
    await deleteDocument(store, d)
    changed()
    navigate(childPath(child!.id, 'documents'))
  }

  return (
    <>
      <PageHeader
        title={doc.title}
        subtitle={`${kindLabel(doc.kind)} · ${formatDate(doc.date)}`}
        back={{ to: childPath(child.id, 'documents'), label: 'Documents' }}
        actions={
          <>
            {EXTRACTABLE.has(doc.kind) && (
              <Link className="button primary" to={childPath(child.id, `documents/${doc.id}/read`)}>
                <ScanText size={16} aria-hidden /> Read measurements with AI
              </Link>
            )}
            {doc.kind === 'doctor-note' && (
              <Link className="button primary" to={childPath(child.id, `documents/${doc.id}/summary`)}>
                <Sparkles size={16} aria-hidden /> Summarise with AI
              </Link>
            )}
          </>
        }
      />
      {doc.kind === 'ultrasound' && (
        <Callout icon={FileHeart}>Ultrasound images are stored and shown only. BabyTrails never sends them to the AI or interprets them.</Callout>
      )}
      <div className="doc-frame">
        <DocumentViewer store={store} doc={doc} />
      </div>
      <button type="button" className="button ghost danger" onClick={() => void remove(doc)}>
        <Trash2 size={16} aria-hidden /> Delete this document
      </button>
    </>
  )
}
