import { Link } from 'react-router-dom'
import type { Unit, IncidentUnit } from './types'

const TYPE_COLORS: Record<string, string> = {
  'Ambulance': 'bg-red-900 text-red-300',
  'Med Unit': 'bg-blue-900 text-blue-300',
  'Rescue': 'bg-green-900 text-green-300',
}

type Props = {
  unit: Unit
  activeIU: IncidentUnit | undefined
  isAdmin: boolean
  isOfflineData: boolean
  onStatusChange: (next: string) => void
}

export default function UnitHeader({ unit, activeIU, isAdmin, isOfflineData, onStatusChange }: Props) {
  const typeName = unit.unit_type?.name || '—'

  return (
    <>
      <Link to="/units" className="text-gray-500 hover:text-gray-300 text-sm">← Units</Link>

      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
          📦 Showing cached data — changes will sync when back online
        </div>
      )}

      <div className="theme-card rounded-xl p-4 border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{unit.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[typeName] || 'bg-gray-700 text-gray-400'}`}>
                {typeName}
              </span>
              {(() => {
                const s = unit.unit_status || 'in_service'
                const deployed = s === 'in_service' && !!activeIU
                const label = deployed ? '● Deployed' : s === 'in_service' ? '○ Available' : s === 'out_of_service' ? '⚠ Out of Service' : 'Archived'
                const cls = deployed ? 'text-green-400' : s === 'out_of_service' ? 'text-yellow-400' : 'text-gray-500'
                return isAdmin ? (
                  <select value={s} onChange={e => onStatusChange(e.target.value)}
                    className={`text-xs bg-transparent border-0 outline-none cursor-pointer appearance-none ${cls}`}>
                    <option value="in_service">{deployed ? '● Deployed' : '○ Available'}</option>
                    <option value="out_of_service">⚠ Out of Service</option>
                    <option value="archived">Archived</option>
                  </select>
                ) : <span className={`text-xs ${cls}`}>{label}</span>
              })()}
            </div>
          </div>
        </div>

        {activeIU?.incident && (
          <div className="mt-3 text-sm text-gray-400">
            📍 <Link to={`/incidents/${activeIU.incident.id}`} className="hover:text-white underline">
              {activeIU.incident.name}
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
