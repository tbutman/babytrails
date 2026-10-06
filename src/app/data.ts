// Reading and writing BabyTrails' records through whichever store is active (vault or demo).

import { useEffect, useMemo, useState } from 'react'
import { deleteDocument, type RecordStore } from '../core'
import { useSession } from './sessionContext'
import type { BabyDocument, Child, Measurement } from './types'

export function useCollection<T extends { id: string }>(collection: string): T[] | null {
  const { store, version } = useSession()
  const [items, setItems] = useState<{ key: unknown; list: T[] } | null>(null)
  useEffect(() => {
    let live = true
    store?.list<T>(collection).then((list) => live && setItems({ key: store, list }))
    return () => {
      live = false
    }
  }, [store, version, collection])
  // Ignore a list loaded from a previous store (for example after leaving the demo).
  return items && items.key === store ? items.list : null
}

export function useChildren(): Child[] | null {
  const children = useCollection<Child>('children')
  return useMemo(() => (children ? [...children].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : null), [children])
}

export function useChild(id: string | undefined): Child | null | undefined {
  const children = useChildren()
  return children === null ? undefined : (children.find((c) => c.id === id) ?? null)
}

export function useMeasurements(childId: string | undefined): Measurement[] | null {
  const all = useCollection<Measurement>('measurements')
  return useMemo(() => (all ? all.filter((m) => m.childId === childId).sort(byDate) : null), [all, childId])
}

export const byDate = (a: { date: string; createdAt?: string }, b: { date: string; createdAt?: string }) =>
  a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')

export async function deleteChild(store: RecordStore, child: Child) {
  for (const m of await store.list<Measurement>('measurements')) {
    if (m.childId === child.id) await store.delete('measurements', m.id)
  }
  for (const d of await store.list<BabyDocument>('documents')) {
    if (d.profileId === child.id) await deleteDocument(store, d)
  }
  if (child.photoBlobId) await store.deleteBlob(child.photoBlobId)
  await store.delete('children', child.id)
}

export function useDocuments(childId: string | undefined): BabyDocument[] | null {
  const all = useCollection<BabyDocument>('documents')
  return useMemo(() => (all ? all.filter((d) => d.profileId === childId).sort((a, b) => b.date.localeCompare(a.date)) : null), [all, childId])
}
