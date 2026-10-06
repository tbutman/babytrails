import { ChevronRight, FileClock, FileHeart, FileImage, FilePlus2, FileText, FileUp, Pencil, ScanText, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { deleteDocument } from '../../core'
import { DocumentViewer } from '../../core/documents/DocumentViewer'
import { Callout, EmptyState, PageHeader, SelectField, TextField } from '../../core/ui/components'
import { childPath } from '../brand'
import { useChild, useDocuments, useMeasurements } from '../data'
import { formatDate } from '../format'
import { useSession, useStore } from '../sessionContext'
import { notReadYet } from '../import/notReadYet'
import { DOCUMENT_KINDS, EXTRACTABLE, today, type BabyDocument, type DocumentKind } from '../types'

const kindLabel = (k: DocumentKind) => DOCUMENT_KINDS.find((d) => d.value === k)?.label ?? k
const kindIcon = (d: BabyDocument) => (d.kind === 'ultrasound' ? FileHeart : d.mimeType === 'application/pdf' ? FileText : FileImage)

export function Documents() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const docs = useDocuments(id)
  const measurements = useMeasurements(id)
  if (!child || docs === null || measurements === null) return null
  const unread = notReadYet(docs, measurements)
  const importLink = (ids?: string[]) => childPath(child.id, `documents/import${ids?.length ? `?documents=${ids.join(',')}` : ''}`)
  const add = (
    <Link className="button primary" to={importLink()}>
      <FilePlus2 size={16} aria-hidden /> Add documents
    </Link>
  )

  return (
    <>
      <PageHeader title="Documents" subtitle="Growth reports, booklet pages, doctor's notes and ultrasound images, encrypted on this device" actions={docs.length > 0 && add} />
      {docs.length === 0 ? (
        <EmptyState icon={FileUp} title="No documents yet" action={add}>
          Add PDFs or photos, several at once or in a zip. BabyTrails can read the measurements in growth reports and booklet pages for you to check.
        </EmptyState>
      ) : (
        <>
          {unread.length > 0 && (
            <>
              <h2 className="section-title">
                <FileClock size={14} aria-hidden /> Not read yet · {unread.length}
              </h2>
              <div className="card padless list">
                {unread.map((d) => (
                  <div key={d.id} className="list-row">
                    <span className="list-row-main">
                      <span className="list-row-title">{d.title}</span>
                      <span className="list-row-sub">
                        {kindLabel(d.kind)} · added {formatDate(d.createdAt.slice(0, 10))}
                      </span>
                    </span>
                    <Link className="button small" to={importLink([d.id])}>
                      <ScanText size={14} aria-hidden /> Read
                    </Link>
                  </div>
                ))}
              </div>
              {unread.length > 1 && (
                <p className="row unread-all">
                  <Link className="button small primary" to={importLink(unread.map((d) => d.id))}>
                    Read all {unread.length}
                  </Link>
                </p>
              )}
            </>
          )}
          <h2 className="section-title">
            <FileText size={14} aria-hidden /> All documents · {docs.length}
          </h2>
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
        </>
      )}
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
  const [editing, setEditing] = useState(false)
  if (!child || docs === null) return null
  const doc = docs.find((d) => d.id === docId)
  if (!doc) return <p>This document isn't in your records.</p>

  async function remove(d: BabyDocument) {
    if (!window.confirm(`Delete "${d.title}"? This can't be undone. Measurements read from it stay.`)) return
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
            <button className="button ghost small" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              <Pencil size={14} aria-hidden /> Edit details
            </button>
            {EXTRACTABLE.has(doc.kind) && (
              <Link className="button primary" to={childPath(child.id, `documents/import?documents=${doc.id}`)}>
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
      {editing && <EditDetails doc={doc} onDone={() => setEditing(false)} />}
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

/** Title, date and kind: imports name documents after their files and date them on the day added. */
function EditDetails({ doc, onDone }: { doc: BabyDocument; onDone: () => void }) {
  const store = useStore()
  const { changed } = useSession()
  const [title, setTitle] = useState(doc.title)
  const [date, setDate] = useState(doc.date)
  const [kind, setKind] = useState<DocumentKind>(doc.kind)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Give it a title.')
    if (!date || date > today()) return setError("The date can't be empty or in the future.")
    await store.put('documents', { ...doc, title: title.trim(), date, kind })
    changed()
    onDone()
  }

  return (
    <form onSubmit={submit} className="card" noValidate>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={error} />
      <div className="input-row">
        <TextField label="Date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        <SelectField label="What is it?" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
          {DOCUMENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="row">
        <button className="button primary" type="submit">
          Save
        </button>
        <button className="button ghost" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
