import { useState, lazy, Suspense } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import * as incidentService from '@/lib/services/incidents'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useIncidentData } from '@/hooks/useIncidentData'
import { SortableCard } from '@/components/incidents/SortableCard'
import { IncidentInfoCard } from '@/components/incidents/cards/IncidentInfoCard'
import { UnitsCard } from '@/components/incidents/cards/UnitsCard'
import { DeploymentsCard } from '@/components/incidents/cards/DeploymentsCard'
import { RevenueCard } from '@/components/incidents/cards/RevenueCard'
import { ExpensesCard } from '@/components/incidents/cards/ExpensesCard'
import { EncountersStatCard } from '@/components/incidents/cards/EncountersStatCard'
import { MarStatCard } from '@/components/incidents/cards/MarStatCard'
import { CompClaimsStatCard } from '@/components/incidents/cards/CompClaimsStatCard'
import { SupplyRunsStatCard } from '@/components/incidents/cards/SupplyRunsStatCard'
import { BillingSummaryStatCard } from '@/components/incidents/cards/BillingSummaryStatCard'
import { ReorderStatCard } from '@/components/incidents/cards/ReorderStatCard'
import { ICS214StatCard } from '@/components/incidents/cards/ICS214StatCard'

const LazyUnitMap = lazy(() => import('@/components/maps/UnitMap'))

const DEFAULT_CARD_ORDER = [
  'units', 'encounters', 'supply-runs',
  'reorder-summary', 'mar', 'ics214',
  'billing-summary', 'expenses', 'comp-claims',
  'deployments', 'unit-revenue', 'unit-map',
]

const DEFAULT_SPANS: Record<string, number> = {
  'units': 1, 'encounters': 1, 'supply-runs': 1,
  'reorder-summary': 1, 'mar': 1, 'ics214': 1,
  'billing-summary': 1, 'expenses': 1, 'comp-claims': 1,
  'deployments': 3, 'unit-revenue': 3, 'unit-map': 3,
}


export default function IncidentDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const incidentId = params.id as string

  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment?.employee?.role || '')

  const [activeIncidentId, setActiveIncidentId] = useState(incidentId)
  const [unitFilter, setUnitFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('all')
  const [closingOut, setClosingOut] = useState(false)
  const [closeoutDt, setCloseoutDt] = useState('')

  const dateFilterStart = (() => {
    if (dateFilter === 'all') return null
    const d = new Date()
    if (dateFilter === '7d') d.setDate(d.getDate() - 7)
    else if (dateFilter === '30d') d.setDate(d.getDate() - 30)
    else if (dateFilter === '90d') d.setDate(d.getDate() - 90)
    else return null
    return d.toISOString().slice(0, 10)
  })()

  const [defaultFireId, setDefaultFireId] = useState<string | null>(() => {
    try { return localStorage.getItem('default_incident_id') } catch { return null }
  })
  const isDefaultFire = defaultFireId === activeIncidentId
  const toggleDefaultFire = () => {
    try {
      if (isDefaultFire) {
        localStorage.removeItem('default_incident_id')
        setDefaultFireId(null)
      } else {
        localStorage.setItem('default_incident_id', activeIncidentId)
        setDefaultFireId(activeIncidentId)
      }
    } catch {}
  }

  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_CARD_ORDER)
  const [cardSpans, setCardSpans] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('incident_card_spans') || '{}') } catch { return {} }
  })

  const getSpan = (cardId: string): 1 | 2 | 3 => {
    const s = cardSpans[cardId] ?? DEFAULT_SPANS[cardId] ?? 3
    return Math.min(3, Math.max(1, s)) as 1 | 2 | 3
  }

  const cycleCardSpan = (cardId: string) => {
    setCardSpans(prev => {
      const current = prev[cardId] ?? DEFAULT_SPANS[cardId] ?? 3
      const next = current >= 3 ? 1 : current + 1
      const updated: Record<string, number> = { ...prev, [cardId]: next }
      localStorage.setItem('incident_card_spans', JSON.stringify(updated))
      return updated
    })
  }

  const {
    incident, incidentUnits, allIncidentUnits, allUnits,
    activeIncidents, currentUserId,
    encounterCount, encounters,
    marCount, marEntries,
    compCount, compRows,
    supplyCount, supplyRuns,
    crewDeployments, deployments, allEmployees,
    billingTotal, reorderCount, reorderRows,
    ics214Rows, expenses,
    loading, isOfflineData,
    reload, saveField, patchIncident,
  } = useIncidentData(activeIncidentId, {
    isAdmin,
    assignmentUnit: assignment.unit,
    onCardOrderLoaded: setCardOrder,
  })

  const effectiveUnitFilter = isAdmin ? unitFilter : (assignment.unit?.name || 'All')

  // Date-filtered data arrays
  const dateMatch = (d: string | null | undefined) => !dateFilterStart || !d || d >= dateFilterStart
  const filteredEncounters = encounters.filter(e => dateMatch(e.date))
  const filteredMarEntries = marEntries.filter(m => dateMatch((m as any).date))
  const filteredSupplyRuns = supplyRuns.filter(sr => dateMatch(sr.run_date))
  const filteredCompRows = compRows.filter(c => dateMatch((c as any).date_of_injury))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cardOrder.indexOf(active.id as string)
    const newIndex = cardOrder.indexOf(over.id as string)
    const newOrder = arrayMove(cardOrder, oldIndex, newIndex)
    setCardOrder(newOrder)
    if (currentUserId) {
      await incidentService.upsertUserPreferences(currentUserId, { dashboard_card_order: newOrder })
    }
  }

  const handleCloseOut = async () => {
    if (!closeoutDt) return
    const closedAt = new Date(closeoutDt).toISOString()
    const { error } = await incidentService.updateIncident(activeIncidentId, {
      status: 'Closed',
      end_date: closeoutDt.split('T')[0],
      closed_at: closedAt,
      closed_by: assignment.employee?.name || 'Admin',
    }) as any
    if (error) { toast.error('Failed to close incident: ' + (error as any).message); return }
    patchIncident({ status: 'Closed', end_date: closeoutDt.split('T')[0], closed_at: closedAt } as any)
    setClosingOut(false)
    generatePayrollReport(closedAt)
  }

  const generatePayrollReport = async (closedAt: string) => {
    const { data: deps } = await supabase
      .from('deployments')
      .select('employee_name, employee_role, check_in, check_out, hours_worked, daily_rate')
      .eq('incident_id', activeIncidentId)
      .order('check_in', { ascending: true })
    const rows = (deps || []) as any[]
    const totalHours = rows.reduce((s: number, r: any) => s + (r.hours_worked || 0), 0)
    const totalPay = rows.reduce((s: number, r: any) => {
      const h = r.hours_worked || 0
      const rate = r.daily_rate || 0
      return s + (rate > 0 ? (h / 24) * rate : 0)
    }, 0)
    const reportText = [
      `FINAL PAYROLL REPORT — ${incident?.name}`,
      `Closed: ${new Date(closedAt).toLocaleString()}`,
      `Closed by: ${assignment.employee?.name || 'Admin'}`,
      ``,
      `PERSONNEL SUMMARY (${rows.length} deployment records)`,
      ...rows.map((r: any) => `  ${r.employee_name || 'Unknown'} (${r.employee_role || '—'}): ${r.hours_worked || 0}h`),
      ``,
      `Total Hours: ${totalHours.toFixed(1)}`,
      `Total Est. Pay: $${totalPay.toFixed(2)}`,
      ``,
      `Report generated: ${new Date().toLocaleString()}`,
      `For: Amanda Bragg (Bookkeeper)`,
    ].join('\n')
    await incidentService.updateIncident(activeIncidentId, { notes: reportText })
    toast.success('Incident closed. Payroll report generated and saved to incident notes. Ready for Amanda Bragg.')
  }

  const renderCard = (cardId: string, dragHandleProps: React.HTMLAttributes<HTMLDivElement>, cycleSpan?: () => void, span?: number) => {
    switch (cardId) {
      case 'units':
        return (
          <UnitsCard
            incidentUnits={incidentUnits}
            allUnits={allUnits}
            activeIncidentId={activeIncidentId}
            activeIncidents={activeIncidents}
            isAdmin={isAdmin}
            incident={incident}
            reload={reload}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'deployments':
        return (
          <DeploymentsCard
            activeIncidentId={activeIncidentId}
            crewDeployments={crewDeployments}
            allEmployees={allEmployees}
            incidentUnits={incidentUnits}
            incident={incident}
            isAdmin={isAdmin}
            assignmentEmployeeName={assignment.employee?.name}
            reload={reload}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'unit-revenue':
        return (
          <RevenueCard
            allIncidentUnits={allIncidentUnits}
            crewDeployments={crewDeployments}
            expenses={expenses}
            incident={incident}
            isAdmin={isAdmin}
            reload={reload}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'expenses':
        return (
          <ExpensesCard
            activeIncidentId={activeIncidentId}
            expenses={expenses}
            incidentUnits={incidentUnits}
            isAdmin={isAdmin}
            assignmentEmployee={assignment.employee}
            reload={reload}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'encounters':
        return (
          <EncountersStatCard
            activeIncidentId={activeIncidentId}
            encounters={filteredEncounters}
            encounterCount={dateFilterStart ? filteredEncounters.length : encounterCount}
            isAdmin={isAdmin}
            unitFilter={unitFilter}
            assignment={assignment}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'mar':
        return (
          <MarStatCard
            activeIncidentId={activeIncidentId}
            marEntries={filteredMarEntries}
            marCount={dateFilterStart ? filteredMarEntries.length : marCount}
            isAdmin={isAdmin}
            unitFilter={unitFilter}
            assignment={assignment}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'comp-claims':
        return (
          <CompClaimsStatCard
            activeIncidentId={activeIncidentId}
            compRows={filteredCompRows}
            compCount={dateFilterStart ? filteredCompRows.length : compCount}
            effectiveUnitFilter={effectiveUnitFilter}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'supply-runs':
        return (
          <SupplyRunsStatCard
            activeIncidentId={activeIncidentId}
            supplyRuns={filteredSupplyRuns}
            supplyCount={dateFilterStart ? filteredSupplyRuns.length : supplyCount}
            effectiveUnitFilter={effectiveUnitFilter}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'billing-summary':
        return (
          <BillingSummaryStatCard
            activeIncidentId={activeIncidentId}
            billingTotal={billingTotal}
            isAdmin={isAdmin}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'reorder-summary':
        return (
          <ReorderStatCard
            activeIncidentId={activeIncidentId}
            reorderRows={reorderRows}
            reorderCount={reorderCount}
            effectiveUnitFilter={effectiveUnitFilter}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'ics214':
        return (
          <ICS214StatCard
            activeIncidentId={activeIncidentId}
            ics214Rows={ics214Rows}
            effectiveUnitFilter={effectiveUnitFilter}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          />
        )

      case 'unit-map':
        if (!isAdmin) return null
        return (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 select-none touch-none">⠿</div>
                <h3 className="text-sm font-semibold text-white">Unit Locations</h3>
              </div>
              {cycleSpan && (
                <button onClick={cycleSpan} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-600">
                  {span}→
                </button>
              )}
            </div>
            <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <LazyUnitMap incidentId={activeIncidentId} height="480px" />
            </Suspense>
          </div>
        )

      default:
        return null
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Loading incident...</p>
      </div>
    </div>
  )

  if (!incident) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Incident not found.</p>
        <Link to="/incidents" className="text-red-400 underline text-sm">← All Incidents</Link>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-5 pt-2">
          <Link to="/incidents" className="text-gray-500 hover:text-white text-sm">← Incidents</Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm font-medium truncate">{incident.name}</span>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full shrink-0 ${
            incident.status === 'Active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
          }`}>
            {incident.status}
          </span>
          {isAdmin && incident.status === 'Active' && (
            <a href={`/incidents/${activeIncidentId}/shift-ticket`}
              className="ml-2 text-xs px-3 py-1 bg-blue-800 hover:bg-blue-700 text-blue-200 rounded-lg font-medium transition-colors shrink-0">
              📄 OF-297
            </a>
          )}
          {isAdmin && incident.status === 'Active' && !closingOut && (
            <button onClick={() => { setCloseoutDt(new Date().toISOString().slice(0, 16)); setClosingOut(true) }}
              className="ml-2 text-xs px-3 py-1 bg-orange-800 hover:bg-orange-700 text-orange-200 rounded-lg font-medium transition-colors shrink-0">
              Close Out
            </button>
          )}
        </div>

        {/* Close-out panel */}
        {closingOut && isAdmin && (
          <div className="bg-orange-950/60 border border-orange-700 rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-bold text-orange-300">🔒 Close Out Incident</h3>
            <p className="text-xs text-orange-200/80">Set the official close date/time. This will mark the incident as Closed, record the timestamp, and generate a final payroll report for Amanda Bragg (bookkeeper).</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Close Date &amp; Time</label>
                <input type="datetime-local" value={closeoutDt} onChange={e => setCloseoutDt(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleCloseOut} disabled={!closeoutDt}
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  Confirm Close Out
                </button>
                <button onClick={() => setClosingOut(false)}
                  className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offline banner */}
        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-2">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Closed banner */}
        {incident.status === 'Closed' && (incident as any).closed_at && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-3">
            <span className="text-gray-400 text-sm">📁 Closed</span>
            <span className="text-gray-300 text-sm font-medium">{new Date((incident as any).closed_at).toLocaleString()}</span>
            {(incident as any).closed_by && <span className="text-gray-500 text-xs">by {(incident as any).closed_by}</span>}
          </div>
        )}

        {/* Incident switcher */}
        {isAdmin && activeIncidents.length > 1 && (
          <select
            value={activeIncidentId}
            onChange={e => setActiveIncidentId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4">
            {activeIncidents.map(inc => (
              <option key={inc.id} value={inc.id}>🔥 {inc.name}</option>
            ))}
          </select>
        )}

        {/* Fixed incident info header */}
        <div className="mb-4">
          <IncidentInfoCard
            incident={incident}
            activeIncidentId={activeIncidentId}
            isAdmin={isAdmin}
            isDefaultFire={isDefaultFire}
            toggleDefaultFire={toggleDefaultFire}
            onSaveField={saveField}
            reload={reload}
          />
        </div>

        {/* Draggable card dashboard */}
        <div>
          {/* Filters */}
          {(() => {
            const unitTypeOrderMap: Record<string, number> = { 'Warehouse': 0, 'Med Unit': 1, 'Ambulance': 2, 'REMS': 3, 'Truck': 4 }
            const unitTypeColorMap: Record<string, string> = { 'Warehouse': 'bg-purple-700 text-white', 'Med Unit': 'bg-blue-700 text-white', 'Ambulance': 'bg-red-700 text-white', 'REMS': 'bg-green-700 text-white', 'Truck': 'bg-stone-700 text-white' }
            const unitsFromData = new Set<string>()
            encounters.forEach(enc => { if (enc.unit) unitsFromData.add(enc.unit) })
            marEntries.forEach(mar => { if ((mar as any).med_unit) unitsFromData.add((mar as any).med_unit) })
            supplyRuns.forEach(sr => { if ((sr as any).unit) unitsFromData.add((sr as any).unit) })
            const sortedUnits = Array.from(unitsFromData)
              .map(unitName => {
                const currentAssignment = incidentUnits.find(iu => (iu.unit as any)?.name === unitName)?.unit
                const typeName = (currentAssignment as any)?.unit_type?.name || ''
                return { name: unitName, typeName }
              })
              .sort((a, b) => {
                const aOrder = unitTypeOrderMap[a.typeName] ?? 99
                const bOrder = unitTypeOrderMap[b.typeName] ?? 99
                return aOrder !== bOrder ? aOrder - bOrder : a.name.localeCompare(b.name)
              })
            const unitOptions = ['All', ...sortedUnits.map(u => u.name)]
            const dateOptions = [
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: '90d', label: 'Last 90 Days' },
            ]

            return (
              <>
                {/* Mobile: dropdowns */}
                <div className="flex md:hidden gap-2 mb-3">
                  <select
                    value={unitFilter}
                    onChange={e => setUnitFilter(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {unitOptions.map(u => (
                      <option key={u} value={u}>{u === 'All' ? 'All Units' : u}</option>
                    ))}
                  </select>
                  <select
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="all">All Dates</option>
                    {dateOptions.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Desktop: pills */}
                <div className="hidden md:flex gap-1.5 overflow-x-auto pb-2 mb-3 items-center">
                  {unitOptions.map(u => {
                    const typeName = u === 'All' ? 'All' : sortedUnits.find(su => su.name === u)?.typeName || ''
                    const activeClass = u === 'All' ? 'bg-gray-600 text-white' : (unitTypeColorMap[typeName] || 'bg-gray-600 text-white')
                    return (
                      <button key={u} onClick={() => setUnitFilter(u)}
                        className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                          unitFilter === u ? activeClass : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}>{u}</button>
                    )
                  })}

                  <span className="w-px h-5 bg-gray-700 mx-1 shrink-0" />

                  {dateOptions.map(f => (
                    <button key={f.key} onClick={() => setDateFilter(f.key)}
                      className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                        dateFilter === f.key ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>{f.label}</button>
                  ))}
                </div>
              </>
            )
          })()}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                {cardOrder.map(cardId => {
                  if (cardId === 'unit-map' && !isAdmin) return null
                  return (
                    <SortableCard key={cardId} id={cardId} colSpan={getSpan(cardId)}>
                      {(dragHandleProps) => renderCard(cardId, dragHandleProps, () => cycleCardSpan(cardId), getSpan(cardId)) ?? <div />}
                    </SortableCard>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

      </div>
    </div>
  )
}
