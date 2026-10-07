// Where you were (X-05): a lock, an auto-lock or a reload sends you to the Unlock form, and unlocking
// brings you back. The path is kept in sessionStorage (this tab only, gone when the tab closes), and
// holds no record data: only the address, such as /app/child/<random id>/measurements/new.

import { DEMO_CHILD_ID } from './demoData'

const PLACE = 'babytrails-place'
const DEMO = 'babytrails-demo'

const read = (key: string) => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null) => {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Private modes can refuse storage; then the place just isn't remembered.
  }
}

/** Remembers an address inside the app (not the start screen itself). */
export function rememberPlace(path: string) {
  // The demo's made-up baby isn't in anyone's vault.
  if (path.startsWith('/app/') && !path.includes(DEMO_CHILD_ID)) write(PLACE, path)
}
export const forgetPlace = () => write(PLACE, null)
export const savedPlace = () => read(PLACE)

const SCREENS: [RegExp, string][] = [
  [/\/measurements\/new\?birth=1/, 'Measurements at birth'],
  [/\/measurements\/new/, 'Add a measurement'],
  [/\/measurements\/[^/]+$/, 'Edit measurement'],
  [/\/measurements$/, 'Measurements'],
  [/\/charts$/, 'Growth charts'],
  [/\/documents\/import/, 'Add documents'],
  [/\/documents\/[^/]+\/summary/, 'Summarize this document'],
  [/\/documents/, 'Documents'],
  [/\/share$/, 'Share a report card'],
  [/\/ask/, 'Ask about the numbers'],
  [/\/summary/, 'a summary'],
  [/\/edit$/, 'Edit child'],
  [/\/child\/new$/, 'Add a child'],
  [/\/child\/[^/]+$/, 'the overview'],
  [/\/settings/, 'Settings'],
  [/\/about/, 'About the data and charts'],
]

/** "Add a measurement", for "You were on Add a measurement. Unlock to continue." */
export function placeName(path: string): string {
  return SCREENS.find(([re]) => re.test(path))?.[1] ?? 'a screen of the app'
}

// Set by the Unlock form just before unlocking; read once by the start screen, which then goes there
// instead of to the child's overview.
let resumeTo: string | null = null
export const resumeAfterUnlock = (path: string | null) => {
  resumeTo = path
}
export function takeResume(): string | null {
  const path = resumeTo
  // Cleared after this render, so a double render (React's StrictMode) reads the same answer.
  if (path) setTimeout(() => (resumeTo = null), 0)
  return path
}

/** The demo is running in this tab, so a reload can say it ended. */
export const markDemo = (on: boolean) => write(DEMO, on ? '1' : null)
/** True once after a reload ended the demo. Read in a useState initializer. */
export function demoEndedByReload(): boolean {
  const ended = read(DEMO) === '1'
  if (ended) setTimeout(() => write(DEMO, null), 0)
  return ended
}
