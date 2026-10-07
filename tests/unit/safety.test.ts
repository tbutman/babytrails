// The review's safety fixes (BABY-01, BABY-02, BABY-03, BABY-12, BABY-18). Made-up values.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { measurementChecks } from '../../src/app/checks'
import { buildFacts } from '../../src/app/facts'
import { FirstWeeks } from '../../src/app/FirstWeeks'
import { firstWeeksNote } from '../../src/app/newborn'
import { mentionText } from '../../src/app/mention'
import { beforeTermPlus4Weeks, pretermNotice } from '../../src/app/preterm'
import { loadTables } from '../../src/growth/tables'
import type { Child, Measurement } from '../../src/app/types'

const tables = await loadTables()
const m = (date: string, weightKg?: number, lengthCm?: number, headCm?: number): Measurement => ({
  id: date, childId: 'c', date, weightKg, lengthCm, headCm, source: 'manual', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`,
})
const early: Child = { id: 'c', name: 'Baby Sam', dateOfBirth: '2026-06-01', sex: 'male', gestationalAge: { weeks: 30, days: 2 }, createdAt: '2026-06-01T00:00:00Z' }
const term: Child = { ...early, gestationalAge: undefined }
const html = (child: Child, ms: Measurement[]) => renderToStaticMarkup(createElement(FirstWeeks, { child, measurements: ms, units: 'metric' })).replaceAll('&#x27;', "'")

describe('babies born early (BABY-01)', () => {
  it('treats real birth numbers as expected, not very unlikely', () => {
    const checks = measurementChecks(tables, early, [], { date: '2026-06-01', weightKg: 1.4, lengthCm: 40, headCm: 28 })
    expect(checks.length).toBeGreaterThan(0)
    for (const c of checks) {
      expect(c.level).toBe('check')
      expect(c.text).toBe('Babies born early are smaller at first, so a number far below the chart is expected. Check that it matches the birth record.')
    }
    // The same numbers for a baby born at term are still questioned.
    expect(measurementChecks(tables, term, [], { date: '2026-06-01', headCm: 28 })[0].level).toBe('unlikely')
  })

  it('softens the checks only until 4 weeks after the due date', () => {
    // Due about 9 weeks and 5 days after birth; plus 4 weeks.
    expect(beforeTermPlus4Weeks(early, '2026-09-02')).toBe(true)
    expect(beforeTermPlus4Weeks(early, '2026-09-05')).toBe(false)
  })

  it('says how the percentiles are counted, until about 2 years', () => {
    expect(pretermNotice(early, '2026-08-01')).toBe(
      "Born at 30+2 weeks. These percentiles use age from the date of birth. For babies born early, doctors usually use corrected age (counted from the due date) until about 2 years, so your baby's doctor may see higher percentiles than these.",
    )
    expect(pretermNotice(early, '2028-06-02')).toBeUndefined()
    expect(pretermNotice(term, '2026-08-01')).toBeUndefined()
  })

  it("doesn't list low percentiles as worth mentioning", () => {
    const ms = [m('2026-07-27', 2.6, 46)]
    expect(buildFacts(tables, early, ms, '2026-07-28')!.worthMentioning.filter((f) => f.kind === 'outside')).toEqual([])
    expect(buildFacts(tables, term, ms, '2026-07-28')!.worthMentioning.some((f) => f.kind === 'outside')).toBe(true)
  })
})

describe('worth mentioning (BABY-03)', () => {
  const jane: Child = { id: 'c', name: 'Jane Doe', dateOfBirth: '2026-03-01', sex: 'female', createdAt: '2026-03-01T00:00:00Z' }
  const ms = [m('2026-05-01', 4.9), m('2026-07-09', 7.4), m('2026-08-20', 6.0)]

  it('writes the code’s list as one neutral card', () => {
    const facts = buildFacts(tables, jane, ms, '2026-08-21')!
    const text = mentionText(facts)!
    expect(text).toMatch(/^Worth mentioning at the next check-up: weight has gone down since Jul 9, 2026, and has moved from about the \d+\w\w to the \d+\w\w percentile/)
    expect(text).toMatch(/Babies are hard to weigh and one measurement can be off, so this isn't a diagnosis\. If you're worried, or your baby is feeding poorly or seems unwell, contact your pediatrician sooner\.$/)
  })

  it('says nothing when the list is empty', () => {
    expect(mentionText(buildFacts(tables, jane, [m('2026-05-01', 4.9), m('2026-06-01', 5.6)], '2026-06-02')!)).toBeUndefined()
  })
})

describe('second looks say what to do if the number is right (BABY-12)', () => {
  it('far off the chart, and a big change', () => {
    const far = measurementChecks(tables, term, [], { date: '2026-08-10', lengthCm: 70 })
    expect(far[0].text).toBe("That's far above the chart for this age. Babies are hard to measure, especially at home, so if you can, measure again. If the number is right, show it to your baby's doctor.")
    const jump = measurementChecks(tables, term, [m('2026-07-01', 4.5)], { date: '2026-07-18', weightKg: 6.2 })
    expect(jump[0].text).toMatch(/^That's a big change since .+, 17 days ago\. Check the number; if it's right, it's worth mentioning to your baby's doctor\.$/)
  })
})

describe('the first weeks (BABY-02, BABY-18)', () => {
  it('spells out a loss of more than 10%, and not being back by 3 weeks', () => {
    const out = html(term, [m('2026-06-01', 3.5), m('2026-06-05', 3.08), m('2026-06-24', 3.4)])
    expect(out).toContain(
      "The lowest weight, on day 4, was 12.0% below birth weight. NICE's guideline says a loss of more than 10% should be checked by a health professional, so let your midwife or your baby's doctor know soon, if they don't know already.",
    )
    expect(out).toContain("At the weighing on day 23, your baby wasn't back to birth weight yet. Most babies are by 3 weeks; mention it to your midwife or your baby's doctor.")
    expect(out).toContain('href="https://www.nice.org.uk/guidance/ng75/chapter/Recommendations"')
  })

  it('says when there was no weighing before the regain', () => {
    const out = html(term, [m('2026-06-01', 3.5), m('2026-06-11', 3.3), m('2026-07-09', 4.0)])
    expect(out).toContain('at the day 38 weighing (no weighing between day 10 and day 38)')
  })

  it('compares with birth weight, not the same line, until day 21 or the regain', () => {
    expect(firstWeeksNote(term, [m('2026-06-01', 3.5), m('2026-06-08', 3.3)])).toBe(true)
    expect(firstWeeksNote(term, [m('2026-06-01', 3.5), m('2026-06-08', 3.3), m('2026-06-15', 3.6)])).toBe(true)
    expect(firstWeeksNote(term, [m('2026-06-01', 3.5), m('2026-06-12', 3.6), m('2026-06-19', 3.8)])).toBe(false)
    expect(firstWeeksNote(term, [m('2026-06-01', 3.5), m('2026-06-25', 3.6)])).toBe(false)
  })
})
