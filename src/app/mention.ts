// "Worth mentioning at the next check-up" (BABY-03): the code's own list (facts.worthMentioning),
// written as one neutral sentence for the overview and the report card. The first weeks' flags are
// shown in The first weeks, with NICE's wording, so they're left out here.

import { formatPercentileValue } from '../growth/lms'
import type { Indicator } from '../growth/tables'
import type { Facts, Flag } from './facts'
import { formatDate } from './format'

const SUBJECT: Record<Indicator, string> = {
  wfa: 'weight',
  lhfa: 'length',
  hcfa: 'head circumference',
  wfl: 'weight for length',
  wfh: 'weight for height',
  bfa: 'BMI',
}

function predicate(flag: Flag, since: string | undefined, withDate: boolean): string {
  const when = withDate && since ? ` since ${formatDate(since)}` : ''
  switch (flag.kind) {
    case 'down':
      return `has gone down${since ? ` since ${formatDate(since)}` : ''}`
    case 'move':
      return `has moved from about the ${formatPercentileValue(flag.fromPercentile!)} to the ${formatPercentileValue(flag.toPercentile!)} percentile${when}`
    default:
      return `is ${flag.side} percentile`
  }
}

const list = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`)

/** The clauses, e.g. "weight has gone down since Jul 9, 2026, and has moved from about the 88th to the 2nd percentile". */
export function mentionClauses(facts: Pick<Facts, 'worthMentioning' | 'previous'>): string | undefined {
  const flags = facts.worthMentioning.filter((f) => f.kind === 'outside' || f.kind === 'move' || f.kind === 'down')
  if (!flags.length) return undefined
  const since = facts.previous?.date
  const order: Flag['kind'][] = ['down', 'move', 'outside']
  const subjects = [...new Set(flags.map((f) => SUBJECT[f.indicator]))]
  const parts = subjects.map((subject) => {
    const mine = flags.filter((f) => SUBJECT[f.indicator] === subject).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    const hasDown = mine.some((f) => f.kind === 'down')
    const preds = mine.map((f) => predicate(f, since, !hasDown))
    return `${subject} ${preds.length > 1 ? `${preds.slice(0, -1).join(', ')}, and ${preds.at(-1)}` : preds[0]}`
  })
  return list(parts)
}

/** The whole card's text, or undefined when there's nothing to mention. */
export function mentionText(facts: Pick<Facts, 'worthMentioning' | 'previous'>): string | undefined {
  const clauses = mentionClauses(facts)
  if (!clauses) return undefined
  const weightOnly = facts.worthMentioning.every((f) => f.indicator === 'wfa')
  return `Worth mentioning at the next check-up: ${clauses}. Babies are hard to ${weightOnly ? 'weigh' : 'measure'} and one measurement can be off, so this isn't a diagnosis. If you're worried, or your baby is feeding poorly or seems unwell, contact your pediatrician sooner.`
}
