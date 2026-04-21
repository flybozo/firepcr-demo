import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import { acuityPillClass, patientInitials } from '@/utils/incidentFormatters'
import type { EncounterRow } from '@/types/incident'

export function EncountersStatCard({
  activeIncidentId,
  encounters,
  encounterCount,
  isAdmin,
  unitFilter,
  assignment,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  encounters: EncounterRow[]
  encounterCount: number
  isAdmin: boolean
  unitFilter: string
  assignment: { employee?: { name?: string | null } | null; unit?: { name?: string | null } | null }
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const [encounterSubFilter, setEncounterSubFilter] = useState<'unit' | 'mine'>('unit')
  const [expanded, setExpanded] = useState(false)

  const myName = assignment.employee?.name
  const filteredEncs = encounters.filter(enc => {
    if (isAdmin) return unitFilter === 'All' || enc.unit === unitFilter
    if (encounterSubFilter === 'mine') return (enc as any).created_by === myName || (enc as any).provider_of_record === myName
    return enc.unit === assignment.unit?.name
  })

  return (
    <StatCard
      title="🩺 Patient Encounters"
      count={encounterCount}
      viewAllHref={`/encounters?activeIncidentId=${activeIncidentId}`}
      newHref={`/encounters/new?activeIncidentId=${activeIncidentId}`}
      newLabel="+ New PCR"
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
    >
      {!isAdmin && (
        <div className="flex gap-1.5 px-4 pt-2">
          <button onClick={() => setEncounterSubFilter('unit')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${encounterSubFilter === 'unit' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Unit Encounters
          </button>
          <button onClick={() => setEncounterSubFilter('mine')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${encounterSubFilter === 'mine' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            My Encounters
          </button>
        </div>
      )}
      {filteredEncs.length > 0 ? (
        <>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
            <span className="w-16 shrink-0">Date</span>
            <span className="w-10 shrink-0 text-center">Pt</span>
            <span className="flex-1 min-w-0 hidden sm:block">Unit</span>
            <span className="w-20 shrink-0 text-right">Acuity</span>
          </div>
          {(expanded ? filteredEncs : filteredEncs.slice(0, 5)).map(enc => {
            const acuityRaw = (enc as any).initial_acuity || ''
            const acuityLabel = acuityRaw.split(' ')[0] || '—'
            return (
              <Link
                key={enc.id}
                to={`/encounters/${enc.id}`}
                className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
              >
                <span className="w-16 shrink-0 text-gray-400 text-xs">{enc.date || '—'}</span>
                <span className="w-10 shrink-0 text-center text-xs font-medium">
                  {patientInitials(enc.patient_first_name, enc.patient_last_name)}
                </span>
                <span className="flex-1 min-w-0 text-gray-400 text-xs truncate hidden sm:block">{enc.unit || '—'}</span>
                <span className="w-20 shrink-0 text-right">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${acuityPillClass(acuityRaw)}`}>
                    {acuityLabel}
                  </span>
                </span>
              </Link>
            )
          })}
          {!expanded && filteredEncs.length > 5 && (
            <button onClick={() => setExpanded(true)}
              className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
              Show {filteredEncs.length - 5} more
            </button>
          )}
          {expanded && filteredEncs.length > 5 && (
            <button onClick={() => setExpanded(false)}
              className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
              Show less
            </button>
          )}
        </>
      ) : (
        <p className="text-center text-gray-600 text-sm py-4">No encounters recorded</p>
      )}
    </StatCard>
  )
}
