import { Baby, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Checkbox, PageHeader, Segmented, TextField } from '../../core/ui/components'
import { APP, childPath } from '../brand'
import { deleteChild, useChild, useMeasurements } from '../data'
import { birthMeasurement } from '../newborn'
import { Shell } from '../Layout'
import { useSession, useStore } from '../sessionContext'
import { today, type Child } from '../types'

export function ChildForm() {
  const { id } = useParams()
  const existing = useChild(id)
  if (id && existing === undefined) return null
  if (id && existing === null) return <p>This child isn't in your records.</p>
  const form = <ChildFormInner key={id ?? 'new'} existing={existing ?? undefined} />
  // Editing happens inside the child's layout; adding a new child has its own frame.
  return id ? form : <Shell narrow>{form}</Shell>
}

function ChildFormInner({ existing }: { existing?: Child }) {
  const store = useStore()
  const { changed } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(existing?.name ?? '')
  const [nickname, setNickname] = useState(existing?.nickname ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(existing?.dateOfBirth ?? '')
  const [sex, setSex] = useState<Child['sex'] | undefined>(existing?.sex)
  const [weeks, setWeeks] = useState(existing?.gestationalAge ? String(existing.gestationalAge.weeks) : '')
  const [days, setDays] = useState(existing?.gestationalAge ? String(existing.gestationalAge.days) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [addBirth, setAddBirth] = useState(true)
  const measurements = useMeasurements(existing?.id)
  const birth = existing && measurements ? birthMeasurement(existing, measurements) : undefined

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
      sex: sex!,
      gestationalAge: w ? { weeks: w, days: d } : undefined,
      photoBlobId: existing?.photoBlobId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await store.put('children', child)
    // A birth measurement follows the date of birth if it changes.
    if (birth?.birth && birth.date !== dateOfBirth) await store.put('measurements', { ...birth, date: dateOfBirth, updatedAt: new Date().toISOString() })
    changed()
    navigate(!existing && addBirth ? childPath(child.id, 'measurements/new?birth=1') : childPath(child.id))
  }

  async function remove() {
    if (!existing) return
    if (!window.confirm(`Delete ${existing.name} and all their measurements and documents? This can't be undone.`)) return
    await deleteChild(store, existing)
    changed()
    navigate(APP)
  }

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.nickname || existing.name}` : 'Add a child'}
        back={existing ? { to: childPath(existing.id), label: 'Overview' } : { to: APP, label: 'Back' }}
      />
      <form onSubmit={submit} noValidate className="card">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="off" hint="Only you see this. It's never sent to the AI." />
        <TextField label="Nickname (optional)" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="off" hint="Shown instead of the name, and on shared reports if you like." />
        <TextField label="Date of birth" type="date" max={today()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} error={errors.dateOfBirth} />
        <Segmented
          legend="Sex"
          name="sex"
          options={[
            { value: 'female', label: 'Girl' },
            { value: 'male', label: 'Boy' },
          ]}
          value={sex}
          onChange={setSex}
          hint="The WHO charts are different for girls and boys."
        />
        {errors.sex && (
          <p className="error form-error" role="alert">
            {errors.sex}
          </p>
        )}
        <fieldset>
          <legend>Born at (optional)</legend>
          <div className="input-row">
            <TextField label="Weeks of pregnancy" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
            <TextField label="And days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          {errors.gestation ? (
            <p className="error" role="alert">
              {errors.gestation}
            </p>
          ) : (
            <p className="hint">Recorded for now; charts by corrected age for babies born early come later.</p>
          )}
        </fieldset>
        {existing ? (
          <p>
            <Link className="button small" to={childPath(existing.id, 'measurements/new?birth=1')}>
              <Baby size={14} aria-hidden /> {birth ? 'Edit the measurements at birth' : 'Add the measurements at birth'}
            </Link>
          </p>
        ) : (
          <Checkbox checked={addBirth} onChange={setAddBirth}>
            Add the measurements at birth next <span className="muted">(weight, length and head circumference, if you have them)</span>
          </Checkbox>
        )}
        <div className="row">
          <button className="button primary" type="submit">
            Save
          </button>
          {existing && (
            <button className="button ghost danger" type="button" onClick={() => void remove()}>
              <Trash2 size={16} aria-hidden /> Delete this child
            </button>
          )}
        </div>
      </form>
    </>
  )
}
