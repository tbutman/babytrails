// The way into "Ask about the numbers" from the overview: the suggested questions for this baby's
// data, and a link to ask your own.

import { MessageCircleQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { askFacts } from './askFacts'
import { childPath } from './brand'
import { useTables } from './growthData'
import { askSuggestions } from './prompts/ask'
import { useSession } from './sessionContext'
import { today, type Child, type Measurement } from './types'

export function AskCard({ child, measurements }: { child: Child; measurements: Measurement[] }) {
  const tables = useTables()
  const { app, core, mode } = useSession()
  const facts = tables ? askFacts(tables, child, measurements, today()) : null
  if (!facts) return null
  const ask = childPath(child.id, 'ask')
  return (
    <section className="card ask-card" aria-labelledby="ask-card-title">
      <h2 id="ask-card-title" className="section-title">
        <MessageCircleQuestion size={18} aria-hidden /> Ask about the numbers
      </h2>
      <div className="ask-suggestions">
        {askSuggestions(facts, app.units).map((s) => (
          <Link key={s.id} className="button small" to={`${ask}?q=${encodeURIComponent(s.text)}`}>
            {s.text}
          </Link>
        ))}
        <Link className="button small primary" to={ask}>
          Ask your own question
        </Link>
      </div>
      <p className="hint">
        {mode !== 'demo' && !core.ai.apiKey && <strong>Needs your own AI key. </strong>}
        Answers explain the numbers BabyTrails calculated, and every number is checked against your records before you see it.
      </p>
    </section>
  )
}
