// The review step's columns for a growth report: one row per date, with the measurements printed on it.

import type { Column } from '../../core/review/model'
import { today, type Child } from '../types'

const range = (lo: number, hi: number, what: string) => (v: string) =>
  Number(v) < lo || Number(v) > hi ? `That ${what} looks unusual. Check it against the document.` : undefined

export function measurementColumns(child: Child): Column[] {
  return [
    {
      key: 'date',
      label: 'Date',
      type: 'date',
      required: true,
      validate: (v) => (v < child.dateOfBirth ? 'Before the date of birth.' : v > today() ? 'In the future.' : undefined),
    },
    { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', validate: range(0.3, 40, 'weight') },
    { key: 'statureCm', label: 'Length or height', unit: 'cm', type: 'number', validate: range(25, 130, 'length') },
    {
      key: 'standing',
      label: 'Measured',
      type: 'choice',
      options: [
        { value: 'no', label: 'Lying down' },
        { value: 'yes', label: 'Standing' },
      ],
    },
    { key: 'headCm', label: 'Head', unit: 'cm', type: 'number', validate: range(18, 60, 'head circumference') },
  ]
}
