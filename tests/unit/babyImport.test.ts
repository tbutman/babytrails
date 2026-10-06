import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../src/core'
import { addDocument } from '../../src/core/documents/documents'
import type { StoredDoc } from '../../src/core/import/duplicates'
import type { IntakeFile } from '../../src/core/import/intake'
import { babyAdapter, kindFromName } from '../../src/app/import/babyAdapter'
import { alreadySavedRows } from '../../src/app/import/duplicates'
import { notReadYet } from '../../src/app/import/notReadYet'
import { DEMO_PROPOSALS, SAMPLE_IMPORT_TITLE } from '../../src/app/demo'
import type { BabyDocument, Child, Measurement } from '../../src/app/types'

const child: Child = { id: 'c', name: 'Test Baby', dateOfBirth: '2026-03-15', sex: 'female', createdAt: '2026-03-15T00:00:00Z' }
const m = (date: string, weightKg?: number, lengthCm?: number, headCm?: number, documentId?: string): Measurement => ({
  id: date, childId: 'c', date, weightKg, lengthCm, headCm, documentId, source: 'manual', createdAt: '', updatedAt: '',
})
const pdf = new TextEncoder().encode('%PDF-1.4\nx\n%%EOF') as Uint8Array<ArrayBuffer>
const intakeFile = (name: string, zip?: string) => ({ name, zip }) as IntakeFile

describe('kinds from file names', () => {
  it('guesses ultrasound, doctor\'s note, booklet or growth report, in English and Portuguese', () => {
    expect(kindFromName('Ecografia 20 semanas.jpg')).toBe('ultrasound')
    expect(kindFromName('scan_12w.png')).toBe('ultrasound')
    expect(kindFromName('nota-da-pediatra.pdf')).toBe('doctor-note')
    expect(kindFromName('Letter from Dr Smith.pdf')).toBe('doctor-note')
    expect(kindFromName('Boletim de Saude p12.jpg')).toBe('booklet')
    expect(kindFromName('consulta 6 meses.pdf')).toBe('growth-report')
    // Words inside other words don't count.
    expect(kindFromName('second-check.pdf')).toBe('growth-report')
  })

  it('keeps ultrasound images and doctor\'s notes without reading by default', () => {
    const adapter = babyAdapter({ store: new MemoryStore(), child, model: 'm', demo: true, onSaved: () => {} })
    expect(adapter.storeOnlyByDefault!(intakeFile('ecografia.jpg'))).toBe(true)
    expect(adapter.storeOnlyByDefault!(intakeFile('nota.pdf'))).toBe(true)
    expect(adapter.storeOnlyByDefault!(intakeFile('2026-09.pdf'))).toBe(false)
    expect(adapter.kindFor!(intakeFile('p1.jpg', 'boletim.zip'))).toBe('booklet')
  })
})

describe('already saved', () => {
  it('matches rows to measurements on the same date with the same values', () => {
    const saved = [m('2026-07-15', 6.05, 60.3, 39.7), m('2026-08-14', 6.6)]
    const rows = alreadySavedRows(DEMO_PROPOSALS, saved)
    // 15/07 matches fully; 14/08 has a different saved length (none) but the weight, length and head
    // printed must all match, so it doesn't; 15/09 has nothing saved.
    expect(rows.map((r) => r.values.date)).toEqual(['15/07/2026'])
  })

  it('treats a measurement on the same date with different values as new', () => {
    expect(alreadySavedRows(DEMO_PROPOSALS, [m('2026-07-15', 6.1, 60.3, 39.7)])).toEqual([])
  })

  it("can't match rows whose dates could be read either way", () => {
    const rows = [{ values: { date: '03/04/2026', weightKg: 5 }, confidence: 'high' as const }]
    expect(alreadySavedRows(rows, [m('2026-04-03', 5), m('2026-03-04', 5)])).toEqual([])
  })
})

describe('not read yet', () => {
  const doc = (id: string, kind: BabyDocument['kind'], meta?: object) => ({ id, kind, meta, profileId: 'c' }) as unknown as BabyDocument
  it('lists unread growth reports and booklet pages, and older ones nothing was read from', () => {
    const docs = [doc('a', 'growth-report', { importStatus: 'unread' }), doc('b', 'booklet'), doc('c', 'growth-report'), doc('d', 'ultrasound', { importStatus: 'stored' }), doc('e', 'doctor-note'), doc('f', 'growth-report', { importStatus: 'read' })]
    expect(notReadYet(docs, [m('2026-07-01', 6, undefined, undefined, 'c')]).map((d) => d.id)).toEqual(['a', 'b'])
  })
})

describe('the BabyTrails adapter', () => {
  it('reads only the sample in the demo, and never an ultrasound', async () => {
    const store = new MemoryStore()
    const adapter = babyAdapter({ store, child, model: 'm', demo: true, onSaved: () => {} })
    const sample = { id: 's', title: SAMPLE_IMPORT_TITLE, kind: 'growth-report', mimeType: 'application/pdf' } as StoredDoc
    expect((await adapter.read(sample, pdf)).rows).toEqual(DEMO_PROPOSALS)
    await expect(adapter.read({ ...sample, title: 'other.pdf' }, pdf)).rejects.toThrow('only the sample')
    await expect(adapter.read({ ...sample, kind: 'ultrasound' }, pdf)).rejects.toThrow('Only growth reports')
  })

  it('needs a key outside the demo', async () => {
    const adapter = babyAdapter({ store: new MemoryStore(), child, model: 'm', demo: false, onSaved: () => {} })
    expect(adapter.canRead).toBe(false)
    await expect(adapter.read({ id: 's', title: 'x.pdf', kind: 'growth-report', mimeType: 'application/pdf' } as StoredDoc, pdf)).rejects.toThrow('API key')
  })

  it('saves measurements linked to the document, dates the document, and then finds them already saved', async () => {
    const store = new MemoryStore()
    let saved = 0
    const adapter = babyAdapter({ store, child, model: 'm', demo: true, onSaved: (n) => void (saved += n) })
    const doc = (await addDocument(store, new Blob([pdf]), { profileId: 'c', date: '2026-10-06', kind: 'growth-report', title: SAMPLE_IMPORT_TITLE, meta: {} })) as StoredDoc
    const outcome = await adapter.save(
      doc,
      [
        { date: '2026-07-15', weightKg: 6.05, statureCm: 60.3, standing: 'no', headCm: 39.7 },
        { date: '2026-08-14', weightKg: 6.6, statureCm: 62.5, standing: undefined, headCm: 40.8 },
      ],
      {},
    )
    expect(outcome).toBe('2 measurements, 15 Jul 2026 to 14 Aug 2026')
    expect(saved).toBe(2)
    const ms = await store.list<Measurement>('measurements')
    expect(ms.map((x) => [x.date, x.lengthCm, x.heightCm, x.documentId, x.source])).toEqual([
      ['2026-07-15', 60.3, undefined, doc.id, 'extracted'],
      ['2026-08-14', 62.5, undefined, doc.id, 'extracted'], // no "standing" printed: lying, under 2 years
    ])
    expect((await store.get<StoredDoc>('documents', doc.id))?.date).toBe('2026-08-14')

    const check = await adapter.check!({ rows: DEMO_PROPOSALS, meta: {}, dropped: 0 })
    expect(check.alreadySaved.map((r) => r.values.date)).toEqual(['15/07/2026', '14/08/2026'])
    expect(check.similar?.detail).toBe('2 of 3 measurements are already saved for the same dates.')
  })
})
