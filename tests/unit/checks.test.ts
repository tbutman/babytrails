import { describe, expect, it } from 'vitest'
import { measurementChecks } from '../../src/app/checks'
import { measurementColumns } from '../../src/app/import/columns'
import { babyAdapter } from '../../src/app/import/babyAdapter'
import { MemoryStore } from '../../src/core'
import { rowWarnings, initRows } from '../../src/core/review/model'
import { loadTables } from '../../src/growth/tables'
import { counted, type Child, type Measurement } from '../../src/app/types'

const tables = await loadTables()
// Made-up values.
const child: Child = { id: 'c', name: 'Test Baby', dateOfBirth: '2026-04-01', sex: 'male', createdAt: '2026-04-01T00:00:00Z' }
const m = (date: string, weightKg?: number, lengthCm?: number, headCm?: number, extra: Partial<Measurement> = {}): Measurement => ({
  id: date, childId: 'c', date, weightKg, lengthCm, headCm, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`, ...extra,
})
const saved = [m('2026-05-15', 5.0, 57, 38.5)]

describe('second looks', () => {
  it('says nothing about an ordinary measurement', () => {
    expect(measurementChecks(tables, child, saved, { date: '2026-06-15', weightKg: 6.0, lengthCm: 61, headCm: 40.5 })).toEqual([])
  })

  it('asks to measure again when a value is far off the chart for the age', () => {
    // Length z ≈ +4 at about 10 weeks.
    const c = measurementChecks(tables, child, [], { date: '2026-06-10', lengthCm: 68 })
    expect(c).toEqual([expect.objectContaining({ field: 'stature', level: 'check' })])
    expect(c[0].text).toMatch(/far above the chart for this age/)
  })

  it("marks values beyond WHO's implausible limits as very unlikely", () => {
    expect(measurementChecks(tables, child, [], { date: '2026-06-15', weightKg: 25 })[0]).toMatchObject({ field: 'weight', level: 'unlikely' })
    expect(measurementChecks(tables, child, [], { date: '2026-06-15', headCm: 25 })[0]).toMatchObject({ field: 'head', level: 'unlikely' })
  })

  it('notices a length or head smaller than last time', () => {
    const c = measurementChecks(tables, child, saved, { date: '2026-06-15', lengthCm: 55.5, headCm: 38.4 })
    expect(c.map((x) => x.field)).toEqual(['stature'])
    expect(c[0].text).toMatch(/1\.5 cm less than on May 15/)
  })

  it('notices a big jump in a short time', () => {
    const c = measurementChecks(tables, child, saved, { date: '2026-06-01', weightKg: 6.6 })
    expect(c[0]).toMatchObject({ field: 'weight', level: 'check' })
    expect(c[0].text).toMatch(/big change since May 15, 17 days ago/)
  })

  it("ignores the measurement being edited, and counts only what isn't left out", () => {
    const edited = m('2026-06-15', 6.0, 61)
    expect(measurementChecks(tables, child, [...saved, edited], { id: edited.id, date: edited.date, weightKg: 6.0, lengthCm: 61 })).toEqual([])
    expect(counted([m('2026-05-01', 4), m('2026-05-02', 9, undefined, undefined, { excluded: true })]).map((x) => x.date)).toEqual(['2026-05-01'])
  })
})

describe('second looks on the review screen', () => {
  it('shows a warning that does not block the row', () => {
    const columns = measurementColumns(child, (c) => measurementChecks(tables, child, saved, c))
    const [row] = initRows([{ values: { date: '01/06/2026', weightKg: '6,6' }, confidence: 'high' }], columns)
    expect(rowWarnings({ ...row, status: 'accepted' }, columns, 'dmy').weightKg).toMatch(/big change since May 15/)
  })

  it('uses the measurements saved so far, loaded when each document is checked', async () => {
    const store = new MemoryStore()
    for (const x of saved) await store.put('measurements', x)
    const adapter = babyAdapter({ store, child, model: 'm', demo: true, tables, onSaved: () => {} })
    const row = (weightKg: string) => initRows([{ values: { date: '01/06/2026', weightKg }, confidence: 'high' }], adapter.columns)[0]
    expect(rowWarnings(row('6,6'), adapter.columns, 'dmy').weightKg).toBeUndefined()
    await adapter.check!({ rows: [], meta: {}, dropped: 0 })
    expect(rowWarnings(row('6,6'), adapter.columns, 'dmy').weightKg).toMatch(/big change/)
  })
})
