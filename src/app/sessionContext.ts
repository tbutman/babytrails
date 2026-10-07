// The session's shape and the hooks screens use to read it. The provider is in session.tsx.

import { createContext, useContext } from 'react'
import type { RecordStore, Trails } from '../core'
import type { CoreSettings } from '../core/settings/settings'
import type { AppSettings } from './types'

export type Mode = 'loading' | 'welcome' | 'locked' | 'unlocked' | 'demo'

/** A one-off message for the start screen: after a restore, the Unlock form says so; after setup,
 * the first screen says where the records live. */
export type Notice = 'restored' | 'created' | null

export type Session = {
  mode: Mode
  trails: Trails | null
  store: RecordStore | null
  core: CoreSettings
  app: AppSettings
  /** When this vault was set up, for the backup reminder. */
  vaultCreatedAt?: string
  // Bumped after every write, so lists reload.
  version: number
  changed: () => void
  createVault: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  startDemo: () => Promise<void>
  exitDemo: () => void
  saveCore: (next: CoreSettings) => Promise<void>
  saveApp: (next: AppSettings) => Promise<void>
  reload: () => Promise<void>
  notice: Notice
  setNotice: (notice: Notice) => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside SessionProvider')
  return session
}

// A store that's always there while unlocked or in the demo; screens behind the lock can use it.
export function useStore(): RecordStore {
  const { store } = useSession()
  if (!store) throw new Error('No store: the vault is locked')
  return store
}

