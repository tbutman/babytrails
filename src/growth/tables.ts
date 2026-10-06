// The WHO tables, generated at build time by scripts/who-data.mjs (they're © WHO and not committed).
// Loaded lazily so the first screen doesn't wait for them.

import type { Lms } from './lms'
import type { VelocityTables } from './velocity'

export type Sex = 'female' | 'male'
export type Indicator = 'wfa' | 'lhfa' | 'wfl' | 'wfh' | 'hcfa' | 'bfa'

type Columns = { L: number[]; M: number[]; S: number[] }
export type Table = { x: 'day' | 'cm'; start: number; step: number; male: Columns; female: Columns }
// The attained-growth tables, and WHO's weight velocity tables alongside them.
export type Tables = Record<Indicator, Table> & { velocity?: VelocityTables }

let loading: Promise<Tables> | undefined

export function loadTables(): Promise<Tables> {
  loading ??= Promise.all([
    import('./data/wfa.json'),
    import('./data/lhfa.json'),
    import('./data/wfl.json'),
    import('./data/wfh.json'),
    import('./data/hcfa.json'),
    import('./data/bfa.json'),
    import('./data/velocity.json'),
  ]).then(([wfa, lhfa, wfl, wfh, hcfa, bfa, velocity]) => ({
    wfa: wfa.default as Table,
    lhfa: lhfa.default as Table,
    wfl: wfl.default as Table,
    wfh: wfh.default as Table,
    hcfa: hcfa.default as Table,
    bfa: bfa.default as Table,
    velocity: velocity.default as VelocityTables,
  }))
  return loading
}

export function tableRange(table: Table): [number, number] {
  return [table.start, table.start + (table.male.L.length - 1) * table.step]
}

// L, M and S at x (a day of age, or a length or height in cm), or undefined outside the table.
// Age tables are looked up by whole day, as WHO's anthro does. Length and height tables are linearly
// interpolated between their 0.1 cm rows, which gives the exact row for values with one decimal.
export function lmsAt(table: Table, sex: Sex, x: number): Lms | undefined {
  const cols = table[sex]
  const last = cols.L.length - 1
  const pos = (x - table.start) / table.step
  if (table.x === 'day') {
    const i = Math.round(pos)
    if (i < 0 || i > last) return undefined
    return { L: cols.L[i], M: cols.M[i], S: cols.S[i] }
  }
  const snapped = Math.round(pos * 1e6) / 1e6
  if (snapped < 0 || snapped > last) return undefined
  const i = Math.floor(snapped)
  const f = snapped - i
  if (f === 0) return { L: cols.L[i], M: cols.M[i], S: cols.S[i] }
  const mix = (c: number[]) => c[i] + (c[i + 1] - c[i]) * f
  return { L: mix(cols.L), M: mix(cols.M), S: mix(cols.S) }
}
