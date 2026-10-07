import { describe, expect, it } from 'vitest'
import { buildCardData, compactAge, plainFirstParagraph } from '../../src/app/report/cardData'
import { wrap } from '../../src/app/report/buildCard'
import { growthFor } from '../../src/app/growthData'
import { allIntervals } from '../../src/app/gains'
import { formatPercentile } from '../../src/growth/lms'
import { loadTables } from '../../src/growth/tables'
import type { Child, Measurement } from '../../src/app/types'

const tables = await loadTables()
// Made-up values.
const child: Child = { id: 'c', name: 'Test Baby', nickname: 'Tess', dateOfBirth: '2026-01-01', sex: 'female', createdAt: '2026-01-01T00:00:00Z' }
const m = (date: string, weightKg?: number, lengthCm?: number, headCm?: number): Measurement => ({
  id: date, childId: 'c', date, weightKg, lengthCm, headCm, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`,
})
const data = [m('2026-01-01', 3.3, 49.5, 34), m('2026-02-01', 4.3, 54, 36.8), m('2026-03-01', 5.2, 57.5, 38.4), m('2026-04-01', 5.9, 60.5, 39.8)]
const opts = { title: 'Tess', subtitle: '3 months old', includeHead: true, includeHistory: true }

describe('report card data', () => {
  const card = buildCardData(tables, child, data, 'metric', '2026-04-10', opts)

  it('shows the same numbers and percentiles as the app', () => {
    const latest = growthFor(tables, child, data.at(-1)!)
    expect(card.tiles.map((t) => [t.label, t.value, t.percentile])).toEqual([
      ['Weight', '5.90 kg', `${formatPercentile(latest.wfa!.z)} percentile`],
      ['Length', '60.5 cm', `${formatPercentile(latest.lhfa!.z)} percentile`],
      ['Head', '39.8 cm', `${formatPercentile(latest.hcfa!.z)} percentile`],
    ])
    expect(card.tiles[0].change).toBe('+700 g since Mar 1')
    expect(card.tiles[1].change).toBe('+3.0 cm since Mar 1')
  })

  it('has the four charts, gain over time and the history, newest first', () => {
    expect(card.charts.map((c) => c.title)).toEqual(['Weight for age', 'Length for age', 'Head circumference for age', 'Weight for length'])
    const last = allIntervals(tables, child, data).weight.at(-1)!
    expect(card.gain?.headline).toBe(`${Math.round(last.rate * 1000)} g a week since Mar 1`)
    expect(card.gain?.bars).toHaveLength(3)
    expect(card.history?.map((r) => r.date)).toEqual(['Apr 1, 2026', 'Mar 1, 2026', 'Feb 1, 2026', 'Jan 1, 2026'])
    expect(card.history?.[0]).toMatchObject({ age: '3 mo', weight: '5.90 kg', length: '60.5 cm', head: '39.8 cm' })
  })

  it('writes neutral highlights from the numbers', () => {
    expect(card.highlights.length).toBeGreaterThanOrEqual(3)
    const text = card.highlights.join(' ')
    expect(text).toMatch(/Weight: .*percentile, last 4/)
    expect(text).toMatch(/Weight for length: .* percentile/)
    expect(text).not.toMatch(/\b(good|normal|healthy|fine|concern|worry)/i)
  })

  it('leaves out head circumference and the history when asked', () => {
    const lean = buildCardData(tables, child, data, 'metric', '2026-04-10', { ...opts, includeHead: false, includeHistory: false })
    expect(lean.tiles.map((t) => t.label)).toEqual(['Weight', 'Length'])
    expect(lean.charts.map((c) => c.choice)).not.toContain('hcfa')
    expect(lean.history).toBeUndefined()
    expect(lean.highlights.join(' ')).not.toContain('Head')
  })

  it('labels an included AI summary, and a demo one as prepared in advance', () => {
    const ai = buildCardData(tables, child, data, 'metric', '2026-04-10', { ...opts, ai: { text: '**Weight** went up.\n\nSecond paragraph.', date: '2026-04-02' } })
    expect(ai.ai).toEqual({ label: 'In plain words · written by AI on Apr 2, 2026', text: 'Weight went up.' })
    const demo = buildCardData(tables, child, data, 'metric', '2026-04-10', { ...opts, ai: { text: 'x', date: '2026-04-02', prepared: true } })
    expect(demo.ai?.label).toBe('In plain words · prepared in advance for the demo')
  })

  it('works with a single measurement', () => {
    const one = buildCardData(tables, child, [data[0]], 'metric', '2026-01-05', opts)
    expect(one.gain).toBeUndefined()
    expect(one.tiles[0].change).toBeUndefined()
    expect(one.history).toHaveLength(1)
  })
})

describe('text helpers', () => {
  it('compacts ages for tables', () => {
    expect(compactAge('5 months, 30 days')).toBe('5 mo 30 d')
    expect(compactAge('1 year, 2 months')).toBe('1 y 2 mo')
    expect(compactAge('12 days')).toBe('12 d')
  })

  it('takes the first paragraph of a summary as plain text', () => {
    expect(plainFirstParagraph('- one **two**\n- three\n\nfour')).toBe('one two three')
  })

  it('wraps by words and ends a cut-off line with an ellipsis', () => {
    expect(wrap('one two three four five six', 100, 20, 9)).toEqual(['one two', 'three four', 'five six'])
    const cut = wrap('one two three four five six', 100, 20, 2)
    expect(cut).toHaveLength(2)
    expect(cut[1].endsWith('…')).toBe(true)
  })
})
