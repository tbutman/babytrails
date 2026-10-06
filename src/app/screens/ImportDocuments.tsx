// Adding documents, and reading the growth reports among them, with the shared import wizard
// (src/core/import): several files or zips at once, duplicates caught, one agreement for the batch,
// then each document checked in turn. ?documents=id,id starts with documents already stored.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import type { StoredDoc } from '../../core/import/duplicates'
import { ImportWizard } from '../../core/import/ImportWizard'
import { PageHeader } from '../../core/ui/components'
import { childPath } from '../brand'
import { useChild } from '../data'
import { babyAdapter } from '../import/babyAdapter'
import { useSession, useStore } from '../sessionContext'

export function ImportDocuments() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const store = useStore()
  const { core, mode, changed, saveCore } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [initial, setInitial] = useState<StoredDoc[] | null>(null)
  // Only on arrival: the wizard keeps its own state from here.
  const [ids] = useState(() => (params.get('documents') ?? '').split(',').filter(Boolean))

  useEffect(() => {
    let live = true
    void store.list<StoredDoc>('documents').then((docs) => live && setInitial(docs.filter((d) => ids.includes(d.id) && d.profileId === id)))
    return () => {
      live = false
    }
  }, [store, id, ids])

  const adapter = useMemo(
    () =>
      child
        ? babyAdapter({
            store,
            child,
            apiKey: core.ai.apiKey,
            model: core.ai.model,
            demo: mode === 'demo',
            onSaved: async (count) => {
              if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + count })
              changed()
            },
          })
        : null,
    [store, child, core, mode, saveCore, changed],
  )

  if (!child || !adapter || initial === null) return <div className="skeleton loading-card" />
  return (
    <ImportWizard
      adapter={adapter}
      store={store}
      profileId={child.id}
      model={core.ai.model}
      initialDocuments={initial}
      demo={mode === 'demo'}
      onFinish={() => {
        changed()
        navigate(childPath(child.id, 'documents'))
      }}
      header={(title) => (
        <PageHeader
          title={title}
          subtitle="Growth reports and booklet pages can be read by the AI; you check every value before anything is saved. Ultrasound images and doctor's notes are kept, not read."
          back={{ to: childPath(child.id, 'documents'), label: 'Documents' }}
        />
      )}
    />
  )
}
