import { ChevronRight, FileText, Plus, Ruler } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { formatLength, formatWeight } from '../../growth/units'
import { EmptyState, PageHeader } from '../../core/ui/components'
import { childPath } from '../brand'
import { useChild, useMeasurements } from '../data'
import { formatAge, formatDate } from '../format'
import { useSession } from '../sessionContext'

export function Measurements() {
  const { id = '' } = useParams()
  const child = useChild(id)
  const measurements = useMeasurements(id)
  const { app } = useSession()
  if (!child || measurements === null) return null
  const units = app.units
  const add = (
    <Link className="button primary" to={childPath(child.id, 'measurements/new')}>
      <Plus size={16} aria-hidden /> Add a measurement
    </Link>
  )

  return (
    <>
      <PageHeader title="Measurements" subtitle={`${measurements.length} recorded`} actions={measurements.length > 0 && add} />
      {measurements.length === 0 ? (
        <EmptyState icon={Ruler} title="No measurements yet" action={add}>
          Weight, length or height and head circumference, each optional.
        </EmptyState>
      ) : (
        <div className="card padless list">
          {[...measurements].reverse().map((m) => (
            <Link key={m.id} to={childPath(child.id, `measurements/${m.id}`)} className="list-row">
              <span className="list-row-main">
                <span className="list-row-title">
                  {formatDate(m.date)} <span className="muted">· {formatAge(child.dateOfBirth, m.date)}</span>
                </span>
                <span className="list-row-sub num">
                  {[
                    m.weightKg !== undefined && formatWeight(m.weightKg, units),
                    m.lengthCm !== undefined && `${formatLength(m.lengthCm, units)} long`,
                    m.heightCm !== undefined && `${formatLength(m.heightCm, units)} tall`,
                    m.headCm !== undefined && `head ${formatLength(m.headCm, units)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {m.source === 'extracted' && <FileText size={16} aria-label="Read from a document" />}
              <ChevronRight size={18} aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
