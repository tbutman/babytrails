import { ChevronRight, FileClock, FileHeart, FileImage, FilePlus2, FileText, FileUp, Pencil, ScanText, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { deleteDocument } from '../../core'
import { pagesOf } from '../../core/documents/documents'
import { DocumentPages } from '../../core/documents/DocumentPages'
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
  // Pages of one document (photos grouped in the import) are listed once, as their first page.
  const firstPages = docs.filter((d) => !d.group || d.group.page === 1)
  const pageCount = (d: (typeof docs)[number]) => pagesOf(d, docs).length
  const idsOf = (list: typeof docs) => list.flatMap((d) => pagesOf(d, docs).map((p) => p.id))
  const unread = notReadYet(firstPages, measurements)
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
                        {kindLabel(d.kind)}
                        {pageCount(d) > 1 && ` · ${pageCount(d)} pages`} · added {formatDate(d.createdAt.slice(0, 10))}
                      </span>
                    </span>
                    <Link className="button small" to={importLink(idsOf([d]))}>
                      <ScanText size={14} aria-hidden /> Read
                    </Link>
                  </div>
                ))}
              </div>
              {unread.length > 1 && (
                <p className="row unread-all">
                  <Link className="button small primary" to={importLink(idsOf(unread))}>
                    Read all {unread.length}
                  </Link>
                </p>
              )}
            </>
          )}
          <h2 className="section-title">
            <FileText size={14} aria-hidden /> All documents · {firstPages.length}
          </h2>
          <div className="card padless list">
            {firstPages.map((d) => {
              const Icon = kindIcon(d)
              return (
                <Link key={d.id} to={childPath(child.id, `documents/${d.id}`)} className="list-row">
                  <Icon size={20} aria-hidden />
                  <span className="list-row-main">
                    <span className="list-row-title">{d.title}</span>
                    <span className="list-row-sub">
                      {kindLabel(d.kind)}
                      {pageCount(d) > 1 && ` · ${pageCount(d)} pages`} · {formatDate(d.date)}
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
  const pages = pagesOf(doc, docs)

  async function remove(d: BabyDocument) {
    const what = pages.length > 1 ? `all ${pages.length} pages of "${d.title}"` : `"${d.title}"`
    if (!window.confirm(`Delete ${what}? This can't be undone. Measurements read from it stay.`)) return
    for (const p of pages) await deleteDocument(store, p)
    changed()
    navigate(childPath(child!.id, 'documents'))
  }

  return (
    <>
      <PageHeader
        title={doc.title}
        subtitle={`${kindLabel(doc.kind)}${pages.length > 1 ? ` · ${pages.length} pages` : ''} · ${formatDate(doc.date)}`}
        back={{ to: childPath(child.id, 'documents'), label: 'Documents' }}
        actions={
          <>
            <button className="button ghost small" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              <Pencil size={14} aria-hidden /> Edit details
            </button>
            {EXTRACTABLE.has(doc.kind) && (
              <Link className="button primary" to={childPath(child.id, `documents/import?documents=${pages.map((p) => p.id).join(',')}`)}>
                <ScanText size={16} aria-hidden /> Read measurements with AI
              </Link>
            )}
            {doc.kind === 'doctor-note' && (
              <Link className="button primary" to={childPath(child.id, `documents/${doc.id}/summary`)}>
                <Sparkles size={16} aria-hidden /> Summarize with AI
              </Link>
            )}
          </>
        }
      />
      {editing && <EditDetails doc={doc} pages={pages} onDone={() => setEditing(false)} />}
      {doc.kind === 'ultrasound' && (
        <Callout icon={FileHeart}>Ultrasound images are stored and shown only. BabyTrails never sends them to the AI or interprets them.</Callout>
      )}
      <div className="doc-frame">{pages.length > 1 ? <DocumentPages store={store} pages={pages} /> : <DocumentViewer store={store} doc={doc} />}</div>
      <button type="button" className="button ghost danger" onClick={() => void remove(doc)}>
        <Trash2 size={16} aria-hidden /> Delete this document{pages.length > 1 ? ` (all ${pages.length} pages)` : ''}
      </button>
    </>
  )
}

/** Title, date and kind: imports name documents after their files and date them on the day added. */
function EditDetails({ doc, pages, onDone }: { doc: BabyDocument; pages: BabyDocument[]; onDone: () => void }) {
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
    // The date and kind belong to the whole document; the title is this page's.
    for (const p of pages) await store.put('documents', p.id === doc.id ? { ...p, title: title.trim(), date, kind } : { ...p, date, kind })
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
