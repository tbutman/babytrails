import type { ImportMeta } from '../../core/import/duplicates'
import { EXTRACTABLE, type BabyDocument, type Measurement } from '../types'

const importStatus = (d: BabyDocument) => (d.meta as ImportMeta | undefined)?.importStatus

/**
 * Growth reports and booklet pages whose measurements haven't been read yet: stored by the import
 * without reading, skipped or failed during one, or added before the import existed and never read.
 */
export function notReadYet(docs: BabyDocument[], measurements: Measurement[]): BabyDocument[] {
  const read = new Set(measurements.map((m) => m.documentId).filter(Boolean))
  return docs.filter((d) => EXTRACTABLE.has(d.kind) && (importStatus(d) === 'unread' || (importStatus(d) === undefined && !read.has(d.id))))
}
