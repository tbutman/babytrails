// Ask about the numbers: questions answered from the facts BabyTrails computes, in saved threads.
// Every number in an answer is checked against the facts by the core before it's shown
// (src/core/ask); answers that don't check out are withheld. SPEC 17.8.

import { MessageCircleQuestion, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AiError } from '../../core/ai/client'
import { redactNames } from '../../core/ai/redact'
import { SendSheet } from '../../core/ai/SendSheet'
import { askQuestion, FOLLOW_UP_NOTE } from '../../core/ask/ask'
import { AskThreadView } from '../../core/ask/AskThreadView'
import type { AskThread, AskTurn } from '../../core/ask/model'
import { PageHeader, TextAreaField } from '../../core/ui/components'
import { demoNote } from '../../core/ui/copy'
import { askFacts } from '../askFacts'
import { APP, childPath } from '../brand'
import { Disclaimer } from '../components'
import { useChild, useCollection, useCountedMeasurements } from '../data'
import { DEMO_ANSWERS } from '../demo'
import { factsDigest } from '../facts'
import { formatDate } from '../format'
import { useTables } from '../growthData'
import { ASK_SYSTEM, askSuggestions, OUT_OF_SCOPE } from '../prompts/ask'
import { factsMessage } from '../prompts/summaries'
import { useSession, useStore } from '../sessionContext'
import { nowIso, today } from '../types'

const PREPARED_NOTE = demoNote('baby')

export function Ask() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const child = useChild(id)
  const measurements = useCountedMeasurements(id)
  const tables = useTables()
  const store = useStore()
  const { core, mode, app, changed } = useSession()
  const all = useCollection<AskThread>('askThreads')
  const threads = useMemo(() => (all ?? []).filter((t) => t.profileId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [all, id])
  const thread = threads.find((t) => t.id === params.get('thread'))
  const [question, setQuestion] = useState(params.get('q') ?? '')
  const [pending, setPending] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [digest, setDigest] = useState('')

  const facts = useMemo(() => (child && measurements && tables ? askFacts(tables, child, measurements, today()) : null), [child, measurements, tables])
  useEffect(() => {
    if (facts) void factsDigest({ ...facts, baby: { ...facts.baby, ageDaysToday: 0 } }).then(setDigest)
  }, [facts])

  if (!child || !measurements || !tables) return null
  const back = childPath(child.id)
  if (!facts) {
    return (
      <>
        <PageHeader title="Ask about the numbers" back={{ to: back, label: 'Overview' }} />
        <p>Add a measurement first.</p>
      </>
    )
  }
  const suggestions = askSuggestions(facts, app.units)
  const factsText = redactNames(factsMessage(facts), [child.name, child.nickname], 'your baby')
  const lastDigest = thread?.turns.filter((t) => t.role === 'answer').at(-1)?.factsDigest
  const needsConsent = !thread || lastDigest !== digest

  async function saveTurns(turns: AskTurn[]) {
    const now = nowIso()
    const next: AskThread = thread ? { ...thread, turns: [...thread.turns, ...turns], updatedAt: now } : { id: crypto.randomUUID(), profileId: child!.id, createdAt: now, updatedAt: now, turns }
    await store.put('askThreads', next)
    changed()
    setParams({ thread: next.id }, { replace: true })
  }

  async function submit(q: string) {
    const text = q.trim()
    setError('')
    if (!text) return setError('Type a question first.')
    if (mode === 'demo') {
      const match = suggestions.find((s) => s.text === text)
      const prepared = match && DEMO_ANSWERS[match.id]
      if (!prepared) return setError('In the demo, try one of the suggested questions. Answers to your own questions use your own Anthropic key.')
      setQuestion('')
      return saveTurns([
        { role: 'question', text, createdAt: nowIso() },
        { role: 'answer', kind: 'prepared', text: prepared.text, model: 'prepared in advance', factsDigest: digest, createdAt: nowIso() },
      ])
    }
    if (!core.ai.apiKey) return setError('NO_KEY')
    if (needsConsent) return setPending(text)
    return send(text)
  }

  async function send(text: string) {
    setBusy(true)
    setError('')
    try {
      // A name typed into a question is replaced in everything sent; the thread keeps the parent's words.
      const hide = (t: string) => redactNames(t, [child!.name, child!.nickname], 'your baby')
      const outcome = await askQuestion({
        apiKey: core.ai.apiKey!,
        model: core.ai.model,
        system: ASK_SYSTEM,
        factsText,
        facts,
        history: (thread?.turns ?? []).map((t) => ({ ...t, text: hide(t.text) })),
        question: hide(text),
        subject: 'the baby',
      })
      const ai: AskTurn =
        'withheld' in outcome
          ? { role: 'answer', kind: 'unchecked', text: '', model: core.ai.model, factsDigest: digest, createdAt: nowIso() }
          : { role: 'answer', kind: outcome.answer.kind, text: outcome.answer.text, model: core.ai.model, factsDigest: digest, createdAt: nowIso() }
      await saveTurns([{ role: 'question', text, createdAt: nowIso() }, ai])
      setQuestion('')
      setPending(null)
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(t: AskThread) {
    if (!window.confirm('Delete this conversation?')) return
    await store.delete('askThreads', t.id)
    changed()
    navigate(childPath(child!.id, 'ask'), { replace: true })
  }

  const estimate = { inputTokens: Math.ceil((ASK_SYSTEM.length + factsText.length + (thread ? JSON.stringify(thread.turns).length : 0) + 200) / 3.5), outputTokens: 500 }

  return (
    <>
      <PageHeader
        title="Ask about the numbers"
        subtitle="Answers use only the numbers BabyTrails worked out from your records, and every number is checked before you see it."
        back={{ to: back, label: 'Overview' }}
        actions={
          thread && (
            <Link className="button small" to={childPath(child.id, 'ask')}>
              <Plus size={14} aria-hidden /> New question
            </Link>
          )
        }
      />

      {thread && <AskThreadView turns={thread.turns} outOfScope={OUT_OF_SCOPE} preparedNote={PREPARED_NOTE} />}

      {pending ? (
        <>
          <p className="ask-question pending">{pending}</p>
          <SendSheet
            appName="BabyTrails"
            sending={[
              'Your question',
              "Your baby's sex, age in days and every measurement, as numbers with ages (not dates), with the percentiles and gains BabyTrails calculated",
              ...(thread ? ['The earlier questions and answers in this conversation'] : []),
            ]}
            notSending={["Your baby's name and date of birth", 'The dates of the measurements', 'Your documents and notes']}
            notes={[
              "If your question includes your baby's name or nickname, BabyTrails replaces it with “your baby” before sending.",
              ...(thread ? [FOLLOW_UP_NOTE] : []),
            ]}
            model={core.ai.model}
            estimate={estimate}
            busy={busy}
            onSend={() => void send(pending)}
            onCancel={() => setPending(null)}
          />
        </>
      ) : (
        <form
          className="card ask-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void submit(question)
          }}
        >
          {suggestions.length > 0 && (
            <div className="ask-suggestions" role="group" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button key={s.id} type="button" className="button small" disabled={busy} onClick={() => void submit(s.text)}>
                  {s.text}
                </button>
              ))}
            </div>
          )}
          <TextAreaField label={thread ? 'Ask a follow-up' : 'Your question'} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="row">
            <button className="button primary" type="submit" disabled={busy}>
              <MessageCircleQuestion size={16} aria-hidden /> {busy ? 'Asking…' : 'Ask'}
            </button>
          </div>
          <p className="hint">
            {mode === 'demo'
              ? 'In the demo, the suggested questions have answers prepared in advance.'
              : 'Uses AI with your own key: about 1 to 2 US cents a question. Answers explain the numbers; they never say whether your baby is healthy.'}
          </p>
        </form>
      )}

      {error &&
        (error === 'NO_KEY' ? (
          <p className="callout" role="alert">
            Answers use AI with your own Anthropic API key. <Link to={`${APP}/settings#ai`}>Add one in Settings</Link>.
          </p>
        ) : (
          <p className="error" role="alert">
            {error}
          </p>
        ))}

      {thread && (
        <button type="button" className="button ghost danger small" onClick={() => void remove(thread)}>
          <Trash2 size={14} aria-hidden /> Delete this conversation
        </button>
      )}

      {threads.filter((t) => t.id !== thread?.id).length > 0 && (
        <>
          <h2 className="section-title">Earlier questions</h2>
          <div className="card padless list">
            {threads
              .filter((t) => t.id !== thread?.id)
              .map((t) => (
                <Link key={t.id} className="list-row" to={`${childPath(child.id, 'ask')}?thread=${t.id}`}>
                  <span className="list-row-main">
                    <span className="list-row-title">{t.turns[0]?.text}</span>
                    <span className="list-row-sub">
                      {formatDate(t.updatedAt.slice(0, 10))} · {t.turns.filter((x) => x.role === 'question').length} question{t.turns.filter((x) => x.role === 'question').length === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              ))}
          </div>
        </>
      )}
      <Disclaimer />
    </>
  )
}
