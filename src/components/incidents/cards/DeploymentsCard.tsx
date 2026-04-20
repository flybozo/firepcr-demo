import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import * as incidentService from '@/lib/services/incidents'
import { calcDays, fmtCurrency } from '@/utils/incidentFormatters'
import type { CrewDeployment, DeploymentRecord, Employee, Incident, IncidentUnit } from '@/types/incident'
import { ConfirmDialog } from '@/components/ui'

const inputCls = 'bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500'
const labelCls = 'text-xs text-gray-500 uppercase tracking-wide font-bold mb-1 block'

export function DeploymentsCard({
  activeIncidentId,
  crewDeployments,
  allEmployees,
  incidentUnits,
  incident,
  isAdmin,
  assignmentEmployeeName,
  reload,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  crewDeployments: CrewDeployment[]
  allEmployees: Employee[]
  incidentUnits: IncidentUnit[]
  incident: Incident | null
  isAdmin: boolean
  assignmentEmployeeName?: string | null
  reload: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const { write } = useOfflineWrite()
  const navigate = useNavigate()

  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)
  const [showAddDeployment, setShowAddDeployment] = useState(false)
  const [deployForm, setDeployForm] = useState({ employeeId: '', travelDate: new Date().toISOString().split('T')[0], dailyRate: '', notes: '' })
  const [deploySubmitting, setDeploySubmitting] = useState(false)
  const [editingDeployId, setEditingDeployId] = useState<string | null>(null)
  const [editDeployFields, setEditDeployFields] = useState<Partial<DeploymentRecord>>({})
  const [unitAssignPrompt, setUnitAssignPrompt] = useState<{ empName: string; empId: string; unitNames: string[] } | null>(null)
  const [selectedUnit, setSelectedUnit] = useState('')

  if (!isAdmin) return null

  const deployedEmployeeIds = new Set(crewDeployments.map(d => d.employee_id))
  const availableEmployees = allEmployees.filter(e => !deployedEmployeeIds.has(e.id))

  const handleEmployeeSelect = (empId: string) => {
    const emp = allEmployees.find(e => e.id === empId)
    setDeployForm(f => ({
      ...f,
      employeeId: empId,
      dailyRate: emp?.daily_rate != null ? String(emp.daily_rate) : f.dailyRate,
    }))
  }

  const handleAddDeployment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deployForm.employeeId) return
    setDeploySubmitting(true)
    const { error } = await write('deployment_records', 'insert', {
      employee_id: deployForm.employeeId,
      incident_id: activeIncidentId,
      travel_date: deployForm.travelDate,
      daily_rate: parseFloat(deployForm.dailyRate) || 0,
      status: 'Traveling',
      notes: deployForm.notes || null,
      created_by: assignmentEmployeeName ?? 'Admin',
    })
    if (error) { toast.error('Failed to add deployment: ' + error); setDeploySubmitting(false); return }

    const empAssignments = incidentUnits.flatMap((iu: any) =>
      (iu.unit_assignments || []).map((ua: any) => ua.employee?.id)
    )
    if (!empAssignments.includes(deployForm.employeeId)) {
      const empName = allEmployees.find((e: any) => e.id === deployForm.employeeId)?.name || 'This employee'
      const unitNames = incidentUnits.map((iu: any) => iu.unit?.name).filter(Boolean) as string[]
      if (unitNames.length > 0) {
        setUnitAssignPrompt({ empName, empId: deployForm.employeeId, unitNames })
      }
    }

    setShowAddDeployment(false)
    setDeployForm({ employeeId: '', travelDate: new Date().toISOString().split('T')[0], dailyRate: '', notes: '' })
    setDeploySubmitting(false)
    reload()
  }

  const handleDeleteDeployment = (id: string) => {
    setConfirmAction({
      action: async () => {
        await incidentService.deleteDeploymentRecord(id)
        reload()
      },
      title: 'Delete Deployment',
      message: 'Delete this deployment record?',
      confirmLabel: 'Delete',
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  const handleSaveDeployEdit = async (id: string) => {
    const fields = { ...editDeployFields }
    if (fields.check_out_date && fields.check_out_date !== '') {
      fields.status = 'Released'
    }
    await incidentService.updateDeploymentRecord(id, {
      ...fields,
      admin_override_by: assignmentEmployeeName ?? 'Admin',
      updated_at: new Date().toISOString(),
    })
    setEditingDeployId(null)
    setEditDeployFields({})
    reload()
  }

  const activeCrewCount = crewDeployments.filter(d => !d.released_at).length
  const totalCrewCount = crewDeployments.length

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

      {/* Unit assignment prompt (replaces native prompt()) */}
      {unitAssignPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { setUnitAssignPrompt(null); setSelectedUnit('') }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">👥</span>
              <div>
                <h3 className="font-bold text-white">Assign to Unit</h3>
                <div className="text-gray-300 text-sm mt-1">{unitAssignPrompt.empName} is not assigned to a unit on this incident.</div>
              </div>
            </div>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">Skip — don&apos;t assign</option>
              {unitAssignPrompt.unitNames.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setUnitAssignPrompt(null); setSelectedUnit('') }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors">Skip</button>
              <button onClick={async () => {
                if (selectedUnit) {
                  const matchedIU = incidentUnits.find((iu: any) => iu.unit?.name?.toLowerCase() === selectedUnit.toLowerCase())
                  if (matchedIU) {
                    await write('unit_assignments', 'insert', {
                      incident_unit_id: matchedIU.id,
                      employee_id: unitAssignPrompt.empId,
                      role_on_unit: '',
                    })
                    reload()
                  }
                }
                setUnitAssignPrompt(null); setSelectedUnit('')
              }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors">
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
        {dragHandleProps && (
          <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
        )}
        {cycleSpan && (
          <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
            className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">
            {`${span || 3}/3`}
          </button>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">👥 Deployments</h3>
        <div className="text-right">
          <span className="text-xl font-bold text-white">{activeCrewCount}</span>
          {totalCrewCount > activeCrewCount && (
            <span className="text-xs text-gray-500 ml-1">({totalCrewCount} total)</span>
          )}
        </div>
      </div>

      {crewDeployments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="border-b theme-card-header">
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Employee</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Role</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Unit</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Status</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Rate</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Days</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Owed</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {crewDeployments.map(dep => {
                const isActive = !dep.released_at
                const isEditing = editingDeployId === dep.deployment_id
                const startDate = dep.travel_date || (dep.assigned_at ? dep.assigned_at.split('T')[0] : null) || incident?.start_date || null
                const endDate = dep.released_at ? dep.released_at.split('T')[0] : null
                const days = startDate ? calcDays(startDate, endDate) : 0
                const owed = days * dep.daily_rate

                if (isEditing && dep.deployment_id) {
                  return (
                    <tr key={dep.assignment_id} className="bg-gray-800/50">
                      <td className="px-3 py-2 text-white font-medium" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                            {dep.employee_headshot_url ? (
                              <img src={dep.employee_headshot_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-gray-400 text-xs font-bold">{dep.employee_name.charAt(0)}</span>
                            )}
                          </div>
                          {dep.employee_name} · {dep.employee_role}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-400">{dep.unit_name}</td>
                      <td className="px-3 py-2">
                        <select defaultValue={dep.deploy_status}
                          onChange={e => setEditDeployFields(f => ({ ...f, status: e.target.value }))}
                          className={inputCls}>
                          {['Traveling', 'On Scene', 'Released', 'Emergency Release'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="1" defaultValue={dep.daily_rate}
                          onChange={e => setEditDeployFields(f => ({ ...f, daily_rate: parseFloat(e.target.value) || 0 }))}
                          className={inputCls + ' w-20 text-right'} />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400">{days}{isActive && '+'}</td>
                      <td className="px-3 py-2 text-right text-green-400">{fmtCurrency(owed)}{isActive && '+'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleSaveDeployEdit(dep.deployment_id!)}
                            className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-semibold">Save</button>
                          <button onClick={() => { setEditingDeployId(null); setEditDeployFields({}) }}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={dep.assignment_id} className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${dep.released_at ? 'opacity-50' : ''}`}
                    onClick={() => navigate(`/roster/${dep.employee_id}`)}>
                    <td className="px-3 py-2 text-white font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                          {dep.employee_headshot_url ? (
                            <img src={dep.employee_headshot_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gray-400 text-xs font-bold">{dep.employee_name.charAt(0)}</span>
                          )}
                        </div>
                        <span className="hover:text-blue-400 transition-colors">{dep.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{dep.employee_role}</td>
                    <td className="px-3 py-2 text-gray-400">{dep.unit_name}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        dep.deploy_status === 'On Scene' ? 'bg-green-900/60 text-green-300' :
                        dep.deploy_status === 'Traveling' ? 'bg-yellow-900/60 text-yellow-300' :
                        dep.deploy_status === 'Released' ? 'bg-gray-700 text-gray-400' :
                        'bg-red-900/60 text-red-300'
                      }`}>
                        {isActive && '🔴 '}{dep.deploy_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-green-400">
                      {dep.daily_rate > 0 ? fmtCurrency(dep.daily_rate) : <span className="text-gray-600">—</span>}
                      <span className="text-gray-600 text-xs">/d</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {days > 0 ? days : <span className="text-gray-600">—</span>}
                      {isActive && days > 0 && <span className="ml-0.5 text-gray-500 text-xs">+</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-400">
                      {owed > 0 ? fmtCurrency(owed) : <span className="text-gray-600">—</span>}
                      {isActive && owed > 0 && <span className="ml-0.5 text-gray-500 text-xs">+</span>}
                    </td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {dep.deployment_id ? (
                          <>
                            <button onClick={() => { setEditingDeployId(dep.deployment_id); setEditDeployFields({}) }}
                              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Edit</button>
                            <button onClick={() => handleDeleteDeployment(dep.deployment_id!)}
                              className="px-2 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 rounded text-xs">Del</button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-600 italic">via unit assign</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {(() => {
              let totalDays = 0, totalHrs = 0, totalOwed = 0
              for (const dep of crewDeployments) {
                const start = dep.travel_date || (dep.assigned_at ? dep.assigned_at.split('T')[0] : null) || incident?.start_date || null
                const end = dep.released_at ? dep.released_at.split('T')[0] : null
                const d = start ? calcDays(start, end) : 0
                totalDays += d
                totalHrs += d * dep.hours_per_day
                totalOwed += d * dep.daily_rate
              }
              return (
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/50">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-400">Totals</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400">{totalHrs.toLocaleString()} hrs</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-white">{totalDays}</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-green-400">{fmtCurrency(totalOwed)}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              )
            })()}
          </table>
        </div>
      )}

      {crewDeployments.length === 0 && !showAddDeployment && (
        <p className="px-4 py-6 text-sm text-gray-600 text-center">No crew assigned to this incident</p>
      )}

      {showAddDeployment && (
        <form onSubmit={handleAddDeployment} className="border-t border-gray-800 p-4 space-y-3 theme-card-footer">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Add Deployment</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Employee</label>
              <select value={deployForm.employeeId} onChange={e => handleEmployeeSelect(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select employee...</option>
                {availableEmployees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Travel Date</label>
              <input type="date" value={deployForm.travelDate}
                onChange={e => setDeployForm(f => ({ ...f, travelDate: e.target.value }))}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className={labelCls}>Daily Rate ($)</label>
              <input type="number" step="0.01" value={deployForm.dailyRate}
                onChange={e => setDeployForm(f => ({ ...f, dailyRate: e.target.value }))}
                placeholder="e.g. 1800"
                required
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes (optional)</label>
              <input type="text" value={deployForm.notes}
                onChange={e => setDeployForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={deploySubmitting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
              {deploySubmitting ? 'Adding...' : 'Add Deployment'}
            </button>
            <button type="button" onClick={() => setShowAddDeployment(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 px-4 py-2 theme-card-footer">
        <div className="flex-1" />
        {!showAddDeployment && (
          <button onClick={() => setShowAddDeployment(true)}
            className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">
            + Add Deployment
          </button>
        )}
      </div>
    </div>
  )
}
