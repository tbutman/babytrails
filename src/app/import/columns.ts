// The review step's columns for a growth report: one row per date, with the measurements printed on it.

import type { Column } from '../../core/review/model'
import type { Candidate, Check, Field } from '../checks'
import { ageInDays, HEIGHT_FROM_DAY } from '../../growth/growth'
import { today, type Child } from '../types'

const range = (lo: number, hi: number, what: string) => (v: string) =>
  Number(v) < lo || Number(v) > hi ? `That ${what} looks unusual. Check it against the document.` : undefined

// A row as a candidate measurement, for the second looks: lying or standing as read, or WHO's
// convention for the age if the document didn't say.
function candidate(child: Child, row: Record<string, string | number | undefined>): Candidate | undefined {
  const date = row.date
  if (typeof date !== 'string') return undefined
  const stature = typeof row.statureCm === 'number' ? row.statureCm : undefined
  const standing = row.standing === 'yes' || (row.standing !== 'no' && ageInDays(child.dateOfBirth, date) >= HEIGHT_FROM_DAY)
  return {
    date,
    weightKg: typeof row.weightKg === 'number' ? row.weightKg : undefined,
    lengthCm: stature !== undefined && !standing ? stature : undefined,
    heightCm: stature !== undefined && standing ? stature : undefined,
    headCm: typeof row.headCm === 'number' ? row.headCm : undefined,
  }
}

export function measurementColumns(child: Child, checks?: (c: Candidate) => Check[]): Column[] {
  const warn = (field: Field) => (_: string, row: Record<string, string | number | undefined>) => {
    const c = checks && candidate(child, row)
    return c ? checks(c).find((x) => x.field === field)?.text : undefined
  }
  return [
    {
      key: 'date',
      label: 'Date',
      type: 'date',
      required: true,
      validate: (v) => (v < child.dateOfBirth ? 'Before the date of birth.' : v > today() ? 'In the future.' : undefined),
    },
    { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', validate: range(0.3, 40, 'weight'), warn: warn('weight') },
    { key: 'statureCm', label: 'Length or height', unit: 'cm', type: 'number', validate: range(25, 130, 'length'), warn: warn('stature') },
    {
      key: 'standing',
      label: 'Measured',
      type: 'choice',
      options: [
        { value: 'no', label: 'Lying down' },
        { value: 'yes', label: 'Standing' },
      ],
    },
    { key: 'headCm', label: 'Head', unit: 'cm', type: 'number', validate: range(18, 60, 'head circumference'), warn: warn('head') },
  ]
}
