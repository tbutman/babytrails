import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Field, Page } from '../components'
import { deleteChild, useChild } from '../data'
import { useSession, useStore } from '../sessionContext'
import { today, type Child } from '../types'

export function ChildForm() {
  const { id } = useParams()
  const existing = useChild(id)
  if (id && existing === undefined) return null
  if (id && existing === null) return <Page title="Not found">This child isn't in your records.</Page>
  return <ChildFormInner key={id ?? 'new'} existing={existing ?? undefined} />
}

function ChildFormInner({ existing }: { existing?: Child }) {
  const store = useStore()
  const { changed } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(existing?.name ?? '')
  const [nickname, setNickname] = useState(existing?.nickname ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(existing?.dateOfBirth ?? '')
  const [sex, setSex] = useState<Child['sex'] | ''>(existing?.sex ?? '')
  const [weeks, setWeeks] = useState(existing?.gestationalAge ? String(existing.gestationalAge.weeks) : '')
  const [days, setDays] = useState(existing?.gestationalAge ? String(existing.gestationalAge.days) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter a name or nickname.'
    if (!dateOfBirth) next.dateOfBirth = 'Enter the date of birth.'
    else if (dateOfBirth > today()) next.dateOfBirth = "The date of birth can't be in the future."
    if (!sex) next.sex = 'Choose one. The WHO charts are different for girls and boys.'
    const w = weeks ? Number(weeks) : undefined
    const d = days ? Number(days) : 0
    if (weeks && (!Number.isInteger(w) || w! < 22 || w! > 44)) next.gestation = 'Weeks should be between 22 and 44.'
    if (days && (!Number.isInteger(d) || d < 0 || d > 6)) next.gestation = 'Days should be between 0 and 6.'
    setErrors(next)
    if (Object.keys(next).length) return
    const child: Child = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      dateOfBirth,
      sex: sex as Child['sex'],
      gestationalAge: w ? { weeks: w, days: d } : undefined,
      photoBlobId: existing?.photoBlobId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await store.put('children', child)
    changed()
    navigate(`/child/${child.id}`)
  }

  async function remove() {
    if (!existing) return
    if (!window.confirm(`Delete ${existing.name} and all their measurements? This can't be undone.`)) return
    await deleteChild(store, existing)
    changed()
    navigate('/')
  }

  return (
    <Page title={existing ? `Edit ${existing.name}` : 'Add a child'} back={existing ? `/child/${existing.id}` : '/'}>
      <form onSubmit={submit} noValidate className="stack">
        <Field label="Name" htmlFor="name" error={errors.name} hint="Only you see this. It's never sent to the AI.">
          <input id="name" type="text" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Nickname (optional)" htmlFor="nickname" hint="Used instead of the name on shared reports, if you like.">
          <input id="nickname" type="text" autoComplete="off" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </Field>
        <Field label="Date of birth" htmlFor="dob" error={errors.dateOfBirth}>
          <input id="dob" type="date" max={today()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </Field>
        <fieldset className={`field${errors.sex ? ' has-error' : ''}`}>
          <legend className="legend">Sex</legend>
          <div className="segmented" role="group" aria-label="Sex">
            <button type="button" aria-pressed={sex === 'female'} onClick={() => setSex('female')}>
              Girl
            </button>
            <button type="button" aria-pressed={sex === 'male'} onClick={() => setSex('male')}>
              Boy
            </button>
          </div>
          {errors.sex ? <p className="error" role="alert">{errors.sex}</p> : <p className="hint">The WHO charts are different for girls and boys.</p>}
        </fieldset>
        <fieldset className={`field${errors.gestation ? ' has-error' : ''}`}>
          <legend className="legend">Born at (optional)</legend>
          <div className="inline-fields">
            <input aria-label="Weeks of pregnancy" inputMode="numeric" placeholder="Weeks" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
            <input aria-label="And days" inputMode="numeric" placeholder="Days" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          {errors.gestation ? (
            <p className="error" role="alert">{errors.gestation}</p>
          ) : (
            <p className="hint">Weeks of pregnancy at birth. Recorded for now; charts by corrected age for babies born early come later.</p>
          )}
        </fieldset>
        <button className="button primary" type="submit">
          Save
        </button>
        {existing && (
          <button className="button ghost danger" type="button" onClick={() => void remove()}>
            Delete this child
          </button>
        )}
      </form>
    </Page>
  )
}
