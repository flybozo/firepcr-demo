import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import * as incidentService from '@/lib/services/incidents'
import type { Incident, IncidentUnit, Unit } from '@/types/incident'
import { ConfirmDialog } from '@/components/ui'

export function UnitsCard({
  incidentUnits,
  allUnits,
  activeIncidentId,
  activeIncidents,
  isAdmin,
  incident,
  reload,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  incidentUnits: IncidentUnit[]
  allUnits: Unit[]
  activeIncidentId: string
  activeIncidents: { id: string; name: string }[]
  isAdmin: boolean
  incident: Incident | null
  reload: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const { write } = useOfflineWrite()
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)
  const [assigningUnit, setAssigningUnit] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState('')

  const assignedUnitIds = new Set(incidentUnits.map(iu => iu.unit?.id).filter(Boolean))
  const availableUnits = allUnits.filter(u => {
    if (assignedUnitIds.has(u.id)) return false
    const ut = (u as any).unit_type
    const typeName = Array.isArray(ut) ? ut[0]?.name : ut?.name
    if (typeName === 'Warehouse') return false
    return true
  })

  const assignUnit = async () => {
    if (!selectedUnitId) return
    const selectedUnit = allUnits.find(u => u.id === selectedUnitId) as any
    const unitType = Array.isArray(selectedUnit?.unit_type) ? selectedUnit.unit_type[0] : selectedUnit?.unit_type
    const defaultRate = unitType?.default_contract_rate ?? 0
    await write('incident_units', 'insert', {
      incident_id: activeIncidentId,
      unit_id: selectedUnitId,
      daily_contract_rate: defaultRate || null,
    })
    await write('units', 'update', { id: selectedUnitId, unit_status: 'in_service' })
    setAssigningUnit(false)
    setSelectedUnitId('')
    reload()
  }

  const demobilizeUnit = (incidentUnitId: string, unitName: string) => {
    setConfirmAction({
      action: async () => {
        await incidentService.releaseUnit(incidentUnitId)
        reload()
      },
      title: 'Remove Unit',
      message: `Remove ${unitName} from this incident? This will release all crew assignments too.`,
      confirmLabel: 'Remove',
      icon: '⚠️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  const reassignUnit = (incidentUnitId: string, targetIncidentId: string, unitId: string, unitName: string) => {
    const targetInc = activeIncidents.find(i => i.id === targetIncidentId)
    setConfirmAction({
      action: async () => {
        await incidentService.moveUnit(incidentUnitId, unitId, targetIncidentId)
        reload()
      },
      title: 'Move Unit',
      message: `Move ${unitName} to "${targetInc?.name}"? Crew will be released from current assignment.`,
      confirmLabel: 'Move',
      icon: '⚠️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  // Suppress unused warning — incident may be used for future incident-level context
  void incident

  return (
    <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel={confirmAction?.confirmLabel}
        icon={confirmAction?.icon}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
      <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
        {dragHandleProps && (
          <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
        )}
        {cycleSpan && (
          <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
            className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🚑 Units ({incidentUnits.length})</h3>
        {isAdmin && (
          <button onClick={() => setAssigningUnit(v => !v)}
            className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            {assigningUnit ? '✕' : '+ Assign Unit'}
          </button>
        )}
      </div>
      {assigningUnit && (
        <div className="px-4 py-3 border-b theme-card-header flex gap-2">
          <select value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)}
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Select unit...</option>
            {availableUnits.map(u => (
              <option key={u.id} value={u.id}>{u.name}{(u as any).unit_type?.name ? ` (${(u as any).unit_type.name})` : ''}</option>
            ))}
          </select>
          <button onClick={assignUnit} disabled={!selectedUnitId}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
            Assign
          </button>
        </div>
      )}
      {incidentUnits.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-600 text-center">No units assigned yet.</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {incidentUnits.map(iu => (
            <div key={iu.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors group">
              <Link to={`/units/${iu.unit?.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                  {(iu.unit as any)?.photo_url ? (
                    <img src={(iu.unit as any).photo_url} alt={iu.unit?.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm">{(() => { const t = (iu.unit as any)?.unit_type?.name; return t === 'Ambulance' ? '🚑' : t === 'Med Unit' ? '🏥' : t === 'Rescue' ? '🧗' : t === 'Truck' ? '🚚' : '🚐' })()}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{iu.unit?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{iu._crew_count} crew assigned</p>
                </div>
                {(iu.unit as any)?.unit_type?.name && (() => {
                  const t = (iu.unit as any).unit_type.name
                  const cls = t === 'Ambulance' ? 'bg-red-900 text-red-300' : t === 'Med Unit' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
                  return <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cls}`}>{t}</span>
                })()}
              </Link>
              {isAdmin && (
                <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                  <select className="text-[11px] bg-gray-800 border border-gray-700 rounded-md px-1.5 py-0.5 text-gray-400 focus:outline-none focus:ring-1 focus:ring-red-500 w-[90px] cursor-pointer appearance-none"
                    defaultValue="" onChange={e => {
                      const val = e.target.value
                      if (val === '__demob__') {
                        demobilizeUnit(iu.id, iu.unit?.name || 'unit')
                      } else if (val) {
                        reassignUnit(iu.id, val, iu.unit?.id || '', iu.unit?.name || 'unit')
                      }
                      e.target.value = ''
                    }}
                    title="Move or demobilize unit">
                    <option value="" disabled>⚙ Actions</option>
                    {activeIncidents.filter(i => i.id !== activeIncidentId).map(i => <option key={i.id} value={i.id}>→ {i.name}</option>)}
                    <option value="__demob__">⛔ Demob</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
