import { Link } from 'react-router-dom'
import type { Encounter, EncounterProcedure } from '@/types/encounters'

export function ProceduresSection({
  enc,
  procedures,
  canMedicate,
}: {
  enc: Encounter
  procedures: EncounterProcedure[]
  canMedicate: boolean
}) {
  return (
    <div className="theme-card rounded-xl border overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 pr-10 py-3 theme-card-header border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Procedures {procedures.length > 0 && <span className="text-gray-600 font-normal normal-case ml-1">({procedures.length})</span>}
        </h2>
        {canMedicate && (
          <Link to={`/encounters/procedures/new?encounterId=${enc.encounter_id}`}
            className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
            <span>+</span> Proc
          </Link>
        )}
      </div>
      {procedures.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-600">No procedures recorded.</p>
      ) : (
        <div className="divide-y divide-gray-800">
          {procedures.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="text-xs text-gray-500 w-28 shrink-0">
                {p.performed_at
                  ? new Date(p.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    + ' ' + new Date(p.performed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </span>
              <span className="flex-1 text-white truncate">{p.procedure_name}</span>
              <span className="text-gray-400 text-xs hidden sm:block">{p.performed_by || '—'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.outcome === 'Successful' ? 'bg-green-900 text-green-300' : p.outcome === 'Unsuccessful' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                {p.outcome}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
