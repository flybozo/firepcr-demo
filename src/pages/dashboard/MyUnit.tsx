

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { ConfirmDialog, LoadingSkeleton } from '@/components/ui'
import { useLocationPing } from '@/hooks/useLocationPing'
import { getCachedData } from '@/lib/offlineStore'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'
import { fmtDateCompact } from '@/utils/dateFormatters'

type CrewMember = {
  id: string
  employee: { name: string; role: string } | null
}

type EncounterRow = {
  id: string
  date: string | null
  patient_last_name: string | null
  patient_first_name: string | null
  primary_symptom_text: string | null
  initial_acuity: string | null
}

type CSItem = {
  item_name: string
  quantity: number
}

type LowStockItem = {
  id: string
  item_name: string
  quantity: number
  par_qty: number
}

type DeploymentRecord = {
  id: string
  status: string
  travel_date: string
  check_in_date: string | null
  check_out_date: string | null
  daily_rate: number
  incidents: { name: string } | null
}

export default function MyUnitDashboard() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const assignment = useUserAssignment()
  const { permState, sharing, requestPermission } = useLocationPing(
    assignment.incidentUnit?.incident_id ?? null,
    assignment.incidentUnit?.unit_id ?? null,
  )

  const [crew, setCrew] = useState<CrewMember[]>([])
  const [encounters, setEncounters] = useState<EncounterRow[]>([])
  const [csItems, setCsItems] = useState<CSItem[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [unsignedCount, setUnsignedCount] = useState(0)
  const [marEntries, setMarEntries] = useState<{id:string;date:string|null;item_name:string|null;patient_name:string|null}[]>([])
  const [supplyRuns, setSupplyRuns] = useState<{id:string;run_date:string|null;dispensed_by:string|null}[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null)
  const [deploymentLoading, setDeploymentLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  // Load active deployment
  useEffect(() => {
    if (assignment.loading) return
    if (!assignment.employee) { setDeploymentLoading(false); return }

    const loadDeployment = async () => {
      try {
        const { data } = await supabase
          .from('deployment_records')
          .select('id, status, travel_date, check_in_date, check_out_date, daily_rate, incidents(name)')
          .eq('employee_id', assignment.employee!.id)
          .in('status', ['Traveling', 'On Scene'])
          .order('travel_date', { ascending: false })
          .limit(1)
          .single()
        setDeployment((data as unknown as DeploymentRecord) ?? null)
      } catch {
        setDeployment(null)
      }
      setDeploymentLoading(false)
    }
    loadDeployment()
  }, [assignment.loading, assignment.employee?.id])

  useEffect(() => {
    if (assignment.loading) return
    if (!assignment.incidentUnit) { setDataLoading(false); return }

    const incidentUnitId = assignment.incidentUnit.id
    const unitId = assignment.incidentUnit.unit_id
    const unitName = assignment.unit?.name ?? null
    const incidentId = assignment.incidentUnit.incident_id

    const load = async () => {
      try {
        const [
          { data: crewData },
          { data: encData },
          { data: csData },
          { data: invData },
          { count: unsignedC },
          { data: marData },
          { data: srData },
        ] = await Promise.all([
          // Crew on this incident_unit
          supabase
            .from('unit_assignments')
            .select('id, employee:employees(name, role)')
            .eq('incident_unit_id', incidentUnitId)
            .is('released_at', null),

          // Recent encounters on this unit
          supabase
            .from('patient_encounters')
            .select('id, date, patient_last_name, patient_first_name, unit, primary_symptom_text, initial_acuity')
            .eq('incident_id', incidentId)
            .eq('unit', unitName ?? '')
            .is('deleted_at', null)
            .order('date', { ascending: false })
            .limit(8),

          // CS inventory on this unit (all controlled substances, by unit_id)
          supabase
            .from('unit_inventory')
            .select('item_name, quantity')
            .eq('unit_id', unitId)
            .eq('category', 'CS')
            .gt('quantity', 0)
            .order('item_name'),

          // Low stock from aggregated view (formulary par, summed across lots)
          supabase
            .from('unit_inventory_aggregated')
            .select('unit_id, item_name, category, total_quantity, par_qty, catalog_item_id')
            .eq('unit_id', unitId)
            .gt('par_qty', 0),

          // Unsigned orders count
          supabase
            .from('medical_orders')
            .select('id', { count: 'exact', head: true })
            .eq('incident_id', incidentId)
            .is('signed_at', null),

          // Recent MAR entries
          supabase
            .from('dispense_admin_log')
            .select('id, date, item_name, patient_name')
            .eq('med_unit', unitName ?? '')
            .order('date', { ascending: false })
            .limit(5),

          // Recent supply runs
          supabase
            .from('supply_runs')
            .select('id, run_date, dispensed_by')
            .eq('incident_id', incidentId)
            .order('run_date', { ascending: false })
            .limit(5),
        ])

        setCrew((crewData as unknown as CrewMember[]) ?? [])
        setEncounters((encData as EncounterRow[]) ?? [])
        setCsItems((csData as CSItem[]) ?? [])
        setMarEntries((marData as any[]) ?? [])
        setSupplyRuns((srData as any[]) ?? [])

        const inv = ((invData as any[]) ?? []).map((r: any) => ({
          id: `${r.unit_id}-${r.catalog_item_id || r.item_name}`,
          item_name: r.item_name,
          quantity: r.total_quantity,
          par_qty: r.par_qty,
        }))
        const low = inv
          .filter(i => i.quantity < i.par_qty)
          .sort((a, b) => (a.quantity / Math.max(a.par_qty, 1)) - (b.quantity / Math.max(b.par_qty, 1)))
          .slice(0, 5)
        setLowStock(low)

        setUnsignedCount(unsignedC ?? 0)
      } catch (e) {
        console.error('Dashboard load error:', e)
        // Offline fallback: reconstruct from cache
        try {
          setIsOffline(true)
          const [cachedUnits, cachedEncounters, cachedInv, cachedMar, cachedRuns] = await Promise.all([
            getCachedData('units') as Promise<any[]>,
            getCachedData('encounters') as Promise<any[]>,
            getCachedData('inventory') as Promise<any[]>,
            getCachedData('mar_entries') as Promise<any[]>,
            getCachedData('supply_runs') as Promise<any[]>,
          ])
          // Crew from cached units → incident_units → unit_assignments
          const cachedUnit = cachedUnits.find((u: any) =>
            (u.incident_units || []).some((iu: any) => iu.id === incidentUnitId)
          )
          const cachedIU = cachedUnit?.incident_units?.find((iu: any) => iu.id === incidentUnitId)
          const cachedAssignments = (cachedIU?.unit_assignments || []).filter((a: any) => !a.released_at)
          setCrew(cachedAssignments.filter((a: any) => a.employee).map((a: any) => ({ id: a.employee.id ?? '', employee: { name: a.employee.name, role: a.employee.role } })))

          setEncounters(cachedEncounters.filter((e: any) => e.incident_id === incidentId && e.unit === unitName && !e.deleted_at).sort((a: any, b: any) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 8))

          const unitInv = cachedInv.filter((i: any) => i.unit_id === assignment.incidentUnit?.unit_id)
          // CS items: aggregate by item_name across lots
          const csAgg = new Map<string, number>()
          unitInv.filter((i: any) => i.category === 'CS' && i.quantity > 0).forEach((i: any) => {
            csAgg.set(i.item_name, (csAgg.get(i.item_name) || 0) + (i.quantity ?? 0))
          })
          setCsItems(Array.from(csAgg.entries()).map(([name, qty]) => ({ item_name: name, quantity: qty })).sort((a, b) => a.item_name.localeCompare(b.item_name)))
          // Low stock: aggregate by item_name, compare to max par_qty across lot rows
          // (best effort offline — formulary par not available in cache)
          const aggMap = new Map<string, { item_name: string; quantity: number; par_qty: number }>()
          for (const i of unitInv) {
            const key = i.catalog_item_id || i.item_name
            const existing = aggMap.get(key)
            if (existing) {
              existing.quantity += i.quantity
              if (i.par_qty > existing.par_qty) existing.par_qty = i.par_qty
            } else {
              aggMap.set(key, { item_name: i.item_name, quantity: i.quantity, par_qty: i.par_qty ?? 0 })
            }
          }
          const low = Array.from(aggMap.values())
            .filter(a => a.par_qty > 0 && a.quantity < a.par_qty)
            .map(a => ({ id: a.item_name, item_name: a.item_name, quantity: a.quantity, par_qty: a.par_qty }))
            .sort((a, b) => (a.quantity / Math.max(a.par_qty, 1)) - (b.quantity / Math.max(b.par_qty, 1)))
            .slice(0, 5)
          setLowStock(low)

          setMarEntries(cachedMar.filter((m: any) => m.med_unit === unitName).sort((a: any, b: any) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5))
          setSupplyRuns(cachedRuns.filter((r: any) => r.incident_id === incidentId).sort((a: any, b: any) => (b.run_date ?? '').localeCompare(a.run_date ?? '')).slice(0, 5))
        } catch {}
      } finally {
        setDataLoading(false)
      }
    }

    load()
  }, [assignment.loading, assignment.incidentUnit?.id])

  const handleCheckIn = () => {
    if (!deployment) return
    setConfirmAction({
      action: async () => {
        setCheckingIn(true)
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('deployment_records')
          .update({
            check_in_date: today,
            checked_in_at: new Date().toISOString(),
            status: 'On Scene',
          })
          .eq('id', deployment.id)
          .select('id, status, travel_date, check_in_date, check_out_date, daily_rate, incidents(name)')
          .single()
        if (!error && data) setDeployment(data as unknown as DeploymentRecord)
        setCheckingIn(false)
      },
      title: 'Confirm Check-In',
      message: 'You have arrived at the fire?',
      icon: '✅',
    })
  }

  const handleCheckOut = () => {
    if (!deployment) return
    setConfirmAction({
      action: async () => {
        setCheckingOut(true)
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('deployment_records')
          .update({
            check_out_date: today,
            checked_out_at: new Date().toISOString(),
            status: 'Released',
          })
          .eq('id', deployment.id)
          .select('id, status, travel_date, check_in_date, check_out_date, daily_rate, incidents(name)')
          .single()
        if (!error && data) setDeployment(data as unknown as DeploymentRecord)
        setCheckingOut(false)
      },
      title: 'Confirm Check-Out',
      message: 'You are heading home?',
      icon: '✅',
    })
  }

  if (assignment.loading || dataLoading) return <LoadingSkeleton fullPage message="Loading your dashboard..." />

  if (!assignment.incidentUnit || !assignment.unit) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🚒</div>
          <h1 className="text-xl font-bold mb-2">No Unit Assignment</h1>
          <p className="text-gray-400 text-sm">You are not currently assigned to a unit. Contact your supervisor.</p>
        </div>
      </div>
    )
  }

  const unitName = assignment.unit.name
  const incidentName = assignment.incident?.name ?? 'Unknown Incident'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="mt-8 md:mt-0">
          <h1 className="text-2xl font-bold text-white">🚑 My Unit: {unitName}</h1>
          <p className="text-gray-400 text-sm mt-1">Active Incident: {incidentName}</p>
        </div>

        {/* Offline indicator */}
        {isOffline && (
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-2 text-amber-300 text-sm">
            📶 Offline — showing cached data
          </div>
        )}

        {/* Location sharing banner */}
        {assignment.incidentUnit && permState !== 'granted' && permState !== 'unknown' && (
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
            permState === 'denied'
              ? 'bg-gray-900 border-gray-700'
              : 'bg-blue-950/60 border-blue-700/60'
          }`}>
            <span className="text-xl mt-0.5">{permState === 'denied' ? '🚫' : '📍'}</span>
            <div className="flex-1 min-w-0">
              {permState === 'denied' ? (
                <>
                  <p className="text-sm font-semibold text-gray-300">Location access denied</p>
                  <p className="text-xs text-gray-500 mt-0.5">To share your unit's position on the Live Map, enable location access for this app in your device Settings.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-blue-300">Share your unit's location?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Your position will appear on the Live Map for incident commanders. Only shared while you're on an active incident.</p>
                  <button
                    onClick={requestPermission}
                    className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Enable Location Sharing
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sharing active indicator */}
        {sharing && assignment.incidentUnit && (
          <div className="flex items-center gap-2 px-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-gray-500">Sharing location on Live Map</span>
          </div>
        )}

        {/* Deployment Check-In Widget */}
        {!deploymentLoading && deployment && (
          <div className="bg-gray-900 rounded-xl border border-red-800/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 bg-red-950/30 flex items-center gap-2">
              <span className="text-red-400">🔥</span>
              <h2 className="text-sm font-bold text-red-300 uppercase tracking-wide">My Deployment</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">{deployment.incidents?.name ?? 'Unknown Incident'}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Status:{' '}
                    <span className={`font-medium ${
                      deployment.status === 'On Scene' ? 'text-green-400' :
                      deployment.status === 'Traveling' ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>{deployment.status}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Travel Date: {new Date(deployment.travel_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {deployment.status === 'Traveling' && (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="w-full py-3 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 rounded-xl text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  {checkingIn ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Checking in...</>
                  ) : (
                    '✅ CHECK IN — I\'ve arrived at the fire'
                  )}
                </button>
              )}

              {deployment.status === 'On Scene' && (
                <button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  className="w-full py-3 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 rounded-xl text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  {checkingOut ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Checking out...</>
                  ) : (
                    '🏠 CHECK OUT — I\'m heading home'
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 1 — Shift + Incident stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* My Shift */}
          <div className="theme-card rounded-xl border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">My Shift</p>
            <p className="text-sm text-gray-300 mb-3">{today}</p>
            {crew.length > 0 ? (
              <ul className="space-y-1">
                {crew.map(m => (
                  <li key={m.id} className="flex items-center justify-between">
                    <span className="text-sm text-white">{(m.employee as any)?.name ?? '—'}</span>
                    <span className="text-xs text-gray-500">{(m.employee as any)?.role ?? ''}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">No crew assigned</p>
            )}
          </div>

          {/* Active Incident */}
          <div className="theme-card rounded-xl border p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Active Incident</p>
            <p className="text-base font-semibold text-white">{incidentName}</p>
            {assignment.incident && (
              <Link
                to={`/incidents/${assignment.incidentUnit.incident_id}`}
                className="text-xs text-red-400 hover:text-red-300 mt-2 inline-block"
              >
                View incident →
              </Link>
            )}
          </div>
        </div>

        {/* Row 2 — Recent Encounters + CS On Hand + MAR + Supply Runs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Recent Encounters */}
          <div className={lc.container}>
            <div className="flex items-center justify-between px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Recent Encounters</h3>
              <Link to={`/encounters?unit=${encodeURIComponent(unitName)}`} className="text-xs text-gray-400 hover:text-white">
                View all →
              </Link>
            </div>
            {encounters.length > 0 ? (
              <div className="divide-y divide-gray-800/60">
                {encounters.map(enc => (
                  <Link
                    key={enc.id}
                    to={`/encounters/${enc.id}`}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {[enc.patient_last_name, enc.patient_first_name].filter(Boolean).join(', ') || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{fmtDateCompact(enc.date)} · {enc.primary_symptom_text || '—'}</p>
                    </div>
                    {enc.initial_acuity && (
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                        enc.initial_acuity.startsWith('Green') ? 'bg-green-900 text-green-300' :
                        enc.initial_acuity.startsWith('Yellow') ? 'bg-yellow-900 text-yellow-300' :
                        enc.initial_acuity.startsWith('Red') ? 'bg-red-900 text-red-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>{enc.initial_acuity.split(' ')[0]}</span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No encounters on this unit</p>
            )}
          </div>

          {/* CS On Hand */}
          <div className={lc.container}>
            <div className="flex items-center justify-between px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">🔒 CS On Hand ({csItems.length})</h3>
              <Link to="/cs" className="text-xs text-gray-400 hover:text-white">View all →</Link>
            </div>
            {csItems.length > 0 ? (
              <div className="divide-y divide-gray-800/60">
                {csItems.map(item => (
                  <div key={item.item_name} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-300">{item.item_name}</span>
                    <span className="text-sm font-bold font-mono text-white">{item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No controlled substances on this unit</p>
            )}
          </div>

          {/* MAR — Recent Medications */}
          <div className={lc.container}>
            <div className="flex items-center justify-between px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Medications Administered</h3>
              <Link to="/mar" className="text-xs text-gray-400 hover:text-white">View all →</Link>
            </div>
            {marEntries.length > 0 ? (
              <div className="divide-y divide-gray-800/60">
                {marEntries.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{m.item_name || '—'}</p>
                      <p className="text-xs text-gray-500">{m.date} · {m.patient_name || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No medications logged</p>
            )}
          </div>

          {/* Supply Runs */}
          <div className={lc.container}>
            <div className="flex items-center justify-between px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Supply Runs</h3>
              <Link to="/supply-runs" className="text-xs text-gray-400 hover:text-white">View all →</Link>
            </div>
            {supplyRuns.length > 0 ? (
              <div className="divide-y divide-gray-800/60">
                {supplyRuns.map((sr: any) => (
                  <div key={sr.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{fmtDateCompact(sr.run_date)}</p>
                      <p className="text-xs text-gray-500">{sr.dispensed_by || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No supply runs</p>
            )}
          </div>
        </div>

        {/* Row 3 — Quick Actions */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🚑', label: 'New Patient Encounter', href: '/encounters/new' },
              { icon: '✍️', label: 'AMA / Refusal', href: '/consent/ama' },
              { icon: '💊', label: 'Log Medication', href: '/mar/new' },
              { icon: '🚚', label: 'Supply Run', href: '/supply-runs/new' },
              ...(assignment.incidentUnit?.incident_id ? [{ icon: '🧾', label: 'Log Expense', href: `/incidents/${assignment.incidentUnit.incident_id}` }] : []),
            ].map(action => (
              <Link
                key={action.href}
                to={action.href}
                className="flex items-center gap-3 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-red-500 rounded-xl transition-colors"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            ))}

            {/* Unsigned Orders — only show if count > 0 */}
            {unsignedCount > 0 && (
              <Link
                to="/unsigned-orders"
                className="flex items-center gap-3 p-4 bg-gray-900 hover:bg-gray-800 border border-red-700 rounded-xl transition-colors relative col-span-2"
              >
                <span className="text-xl">📋</span>
                <span className="text-sm font-medium">Unsigned Orders</span>
                <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unsignedCount}
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Row 4 — Low Stock Alert */}
        {lowStock.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-yellow-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-yellow-500">⚠️ Low Stock</h3>
              <Link to="/inventory/reorder" className="text-xs text-gray-400 hover:text-white">View all →</Link>
            </div>
            <div className="divide-y divide-gray-800/60">
              {lowStock.map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-white">{item.item_name}</span>
                  <span className="text-sm">
                    <span className="text-red-400 font-bold">{item.quantity}</span>
                    <span className="text-gray-600"> / {item.par_qty} par</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
