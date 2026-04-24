import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCachedById, getCachedData } from '@/lib/offlineStore'
import { loadSingle } from '@/lib/offlineFirst'
import * as incidentService from '@/lib/services/incidents'
import type {
  CompClaimRow,
  CrewDeployment,
  DeploymentRecord,
  Employee,
  EncounterRow,
  ExpenseRow,
  ICS214Row,
  Incident,
  IncidentUnit,
  MARRow,
  ReorderRow,
  SupplyRunRow,
  Unit,
} from '@/types/incident'

export type IncidentData = {
  incident: Incident | null
  incidentUnits: IncidentUnit[]
  allIncidentUnits: IncidentUnit[]
  allUnits: Unit[]
  activeIncidents: { id: string; name: string }[]
  currentUserId: string | null
  encounterCount: number
  encounters: EncounterRow[]
  marCount: number
  marEntries: MARRow[]
  compCount: number
  compRows: CompClaimRow[]
  supplyCount: number
  supplyRuns: SupplyRunRow[]
  crewDeployments: CrewDeployment[]
  deployments: DeploymentRecord[]
  allEmployees: Employee[]
  billingTotal: number | null
  reorderCount: number | null
  reorderRows: ReorderRow[]
  ics214Rows: ICS214Row[]
  expenses: ExpenseRow[]
  loading: boolean
  isOfflineData: boolean
  reload: () => Promise<void>
  saveField: (key: string, value: string) => Promise<void>
  patchIncident: (fields: Partial<Incident>) => void
}

export function useIncidentData(
  activeIncidentId: string,
  options: {
    isAdmin: boolean
    assignmentUnit?: { id?: string | null; name?: string | null } | null
    onCardOrderLoaded?: (order: string[]) => void
  }
): IncidentData {
  const DEFAULT_CARD_ORDER = [
    'units', 'encounters', 'supply-runs',
    'reorder-summary', 'mar', 'ics214',
    'billing-summary', 'expenses', 'comp-claims',
    'deployments', 'unit-revenue',
  ]

  const { isAdmin, assignmentUnit, onCardOrderLoaded } = options

  const [incident, setIncident] = useState<Incident | null>(null)
  const [incidentUnits, setIncidentUnits] = useState<IncidentUnit[]>([])
  const [allIncidentUnits, setAllIncidentUnits] = useState<IncidentUnit[]>([])
  const [allUnits, setAllUnits] = useState<Unit[]>([])
  const [activeIncidents, setActiveIncidents] = useState<{ id: string; name: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [encounterCount, setEncounterCount] = useState(0)
  const [encounters, setEncounters] = useState<EncounterRow[]>([])
  const [marCount, setMarCount] = useState(0)
  const [marEntries, setMarEntries] = useState<MARRow[]>([])
  const [compCount, setCompCount] = useState(0)
  const [compRows, setCompRows] = useState<CompClaimRow[]>([])
  const [supplyCount, setSupplyCount] = useState(0)
  const [supplyRuns, setSupplyRuns] = useState<SupplyRunRow[]>([])
  const [crewDeployments, setCrewDeployments] = useState<CrewDeployment[]>([])
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [billingTotal, setBillingTotal] = useState<number | null>(null)
  const [reorderCount, setReorderCount] = useState<number | null>(null)
  const [reorderRows, setReorderRows] = useState<ReorderRow[]>([])
  const [ics214Rows, setIcs214Rows] = useState<ICS214Row[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    try {
      const cached = await getCachedById('incidents', activeIncidentId) as any
      if (cached) {
        setIncident(cached)
        setLoading(false)
      }
    } catch {}
    const supabaseClient = createClient()

    const incResult = await loadSingle(
      () => supabaseClient.from('incidents').select('*').eq('id', activeIncidentId).single() as any,
      'incidents',
      activeIncidentId
    )
    const inc = incResult.data
    let iUnits: any[] | null = null
    let allUnitsData: any[] | null = null
    let userData: any = null

    if (incResult.offline) {
      if (inc) {
        setIsOfflineData(true)
        setIncident(inc as Incident)
        const cachedUnits = await getCachedData('units')
        setAllUnits(cachedUnits)
        const cachedIUs = await getCachedData('incident_units')
        const filteredIUs = cachedIUs.filter((iu: any) => iu.incident_id === activeIncidentId && !iu.released_at)
        const mappedIUs = filteredIUs.map((iu: any) => ({
          id: iu.id,
          unit: iu.unit || cachedUnits.find((u: any) => u.id === iu.unit_id) || null,
          _crew_count: 0,
        }))
        setIncidentUnits(mappedIUs)
        const cachedEncs = await getCachedData('encounters')
        const filteredEncs = cachedEncs.filter((e: any) => e.incident_id === activeIncidentId)
        setEncounters(filteredEncs.slice(0, 5))
        setEncounterCount(filteredEncs.length)
        const cachedMar = await getCachedData('mar_entries')
        setMarEntries(cachedMar.slice(0, 3))
        setMarCount(cachedMar.length)
        const cachedRuns = await getCachedData('supply_runs')
        setSupplyRuns(cachedRuns.filter((r: any) => r.incident_id === activeIncidentId).slice(0, 3))
      }
      setLoading(false)
      return
    }

    try {
      const [iuRes, allIuRes, unitsRes, authRes] = await Promise.all([
        supabaseClient.from('incident_units').select(`
          id,
          assigned_at,
          released_at,
          daily_contract_rate,
          unit:units(id, name, photo_url, unit_type:unit_types(name, default_contract_rate)),
          unit_assignments(id)
        `).eq('incident_id', activeIncidentId).is('released_at', null),
        supabaseClient.from('incident_units').select(`
          id,
          assigned_at,
          released_at,
          daily_contract_rate,
          unit:units(id, name, photo_url, unit_type:unit_types(name, default_contract_rate)),
          unit_assignments(id)
        `).eq('incident_id', activeIncidentId),
        supabaseClient.from('units').select('id, name, unit_type:unit_types(name, default_contract_rate)').eq('is_storage', false).order('name'),
        supabaseClient.auth.getSession(),
      ])
      iUnits = iuRes.data; allUnitsData = unitsRes.data; userData = authRes.data
      const allIuMapped: IncidentUnit[] = ((allIuRes.data as unknown as any[]) || []).map((u: any) => {
        const rawType = u.unit?.unit_type
        const unitType = Array.isArray(rawType) ? rawType[0] : rawType
        const defaultRate = unitType?.default_contract_rate ?? 0
        return {
          id: u.id,
          unit: u.unit,
          _crew_count: u.unit_assignments?.length ?? 0,
          assigned_at: u.assigned_at,
          released_at: u.released_at,
          daily_contract_rate: u.daily_contract_rate ?? defaultRate,
        }
      })
      setAllIncidentUnits(allIuMapped)
    } catch {}

    setIncident(inc as Incident | null)
    const { data: actInc } = await supabaseClient
      .from('incidents')
      .select('id, name')
      .eq('status', 'Active')
      .order('name')
    const allActive = actInc || []
    if (inc && !allActive.find((i: any) => i.id === (inc as any).id)) {
      allActive.unshift({ id: (inc as any).id, name: (inc as any).name })
    }
    setActiveIncidents(allActive)

    const userId = (userData as any)?.session?.user?.id ?? null
    setCurrentUserId(userId)

    if (userId) {
      const { data: prefData } = await supabaseClient
        .from('user_preferences')
        .select('dashboard_card_order')
        .eq('auth_user_id', userId)
        .single()
      if (prefData?.dashboard_card_order && Array.isArray(prefData.dashboard_card_order)) {
        const savedOrder = prefData.dashboard_card_order as string[]
        const merged = [
          ...savedOrder.filter((id: string) => DEFAULT_CARD_ORDER.includes(id)),
          ...DEFAULT_CARD_ORDER.filter(id => !savedOrder.includes(id)),
        ]
        onCardOrderLoaded?.(merged)
      }
    }

    const mappedUnits: IncidentUnit[] = ((iUnits as unknown as Array<{
      id: string
      assigned_at?: string
      released_at?: string | null
      daily_contract_rate?: number | null
      unit: { id: string; name: string; unit_type?: any } | null
      unit_assignments: { id: string }[]
    }>) || []).map(u => {
      const rawType = (u.unit as any)?.unit_type
      const unitType = Array.isArray(rawType) ? rawType[0] : rawType
      const defaultRate = unitType?.default_contract_rate ?? 0
      return {
        id: u.id,
        unit: u.unit,
        _crew_count: u.unit_assignments?.length ?? 0,
        assigned_at: u.assigned_at,
        released_at: u.released_at,
        daily_contract_rate: u.daily_contract_rate ?? defaultRate,
      }
    })
    setIncidentUnits(mappedUnits)
    setAllUnits((allUnitsData as Unit[]) || [])

    const assignedUnitIds = mappedUnits.map(u => u.unit?.id).filter(Boolean) as string[]

    const [
      { count: encCount, data: encData },
      { count: marC, data: marData },
      { count: compC },
      { data: srData },
    ] = await Promise.all([
      (async () => {
        const r1 = await supabaseClient
          .from('patient_encounters')
          .select('id, date, patient_last_name, patient_first_name, unit, initial_acuity', { count: 'exact' })
          .eq('incident_id', activeIncidentId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(5)
        if (r1.count && r1.count > 0) return r1
        if ((inc as any)?.name) {
          return supabaseClient
            .from('patient_encounters')
            .select('id, date, patient_last_name, patient_first_name, unit, initial_acuity', { count: 'exact' })
            .ilike('incident', `%${(inc as any).name}%`)
            .is('deleted_at', null)
            .order('date', { ascending: false })
            .limit(5)
        }
        return r1
      })(),

      (async () => {
        let { data: encIds } = await supabaseClient
          .from('patient_encounters')
          .select('encounter_id')
          .eq('incident_id', activeIncidentId)
          .is('deleted_at', null)
        if (!encIds?.length && (inc as any)?.name) {
          const r2 = await supabaseClient.from('patient_encounters').select('encounter_id').ilike('incident', `%${(inc as any).name}%`).is('deleted_at', null)
          encIds = r2.data
        }
        const ids = (encIds || []).map((e: { encounter_id: string }) => e.encounter_id)
        if (ids.length === 0) return { count: 0, data: [] }
        return supabaseClient
          .from('dispense_admin_log')
          .select('id, date, item_name, med_unit', { count: 'exact' })
          .in('encounter_id', ids)
          .order('date', { ascending: false })
          .limit(3)
      })(),

      (async () => {
        try {
          let compQuery = supabaseClient
            .from('comp_claims')
            .select('id', { count: 'exact', head: true })
            .eq('incident_id', activeIncidentId)
          if (!isAdmin && assignmentUnit?.name) compQuery = (compQuery as any).eq('unit', assignmentUnit.name)
          const { count: directCount } = await compQuery
          if (directCount && directCount > 0) return { count: directCount }
          const incName = (inc as any)?.name
          if (incName) {
            return supabaseClient.from('comp_claims').select('id', { count: 'exact', head: true }).ilike('incident', `%${incName}%`)
          }
          return { count: 0 }
        } catch { return { count: 0 } }
      })(),

      (async () => {
        const iuIds = mappedUnits.map(u => u.id)
        if (iuIds.length === 0) return { data: [] }
        return supabaseClient
          .from('supply_runs')
          .select('id, run_date, incident_unit:incident_units(unit:units(name)), supply_run_items(id)')
          .eq('incident_id', activeIncidentId)
          .order('run_date', { ascending: false })
          .limit(50)
      })(),
    ])

    setEncounterCount(encCount ?? 0)
    setEncounters((encData as EncounterRow[]) || [])
    setMarCount(marC ?? 0)
    setMarEntries((marData as MARRow[]) || [])
    setCompCount(compC ?? 0)

    ;(async () => {
      try {
        const { data } = await supabaseClient
          .from('comp_claims')
          .select('id, patient_name, unit, date_of_injury, status, injury_type, pdf_url')
          .eq('incident_id', activeIncidentId)
          .is('deleted_at', null)
          .order('date_of_injury', { ascending: false })
          .limit(50)
        setCompRows((data as any[]) || [])
      } catch { setCompRows([]) }
    })()

    const srRows = ((srData as any[]) || []).map((sr: any) => ({
      ...sr,
      item_count: Array.isArray(sr.supply_run_items) ? sr.supply_run_items.length : 0,
      supply_run_items: undefined,
    })) as SupplyRunRow[]
    setSupplyRuns(srRows)

    // Use same filter as data query for consistent count
    const { count: srCount } = await supabaseClient
      .from('supply_runs')
      .select('id', { count: 'exact', head: true })
      .eq('incident_id', activeIncidentId)
    setSupplyCount(srCount ?? 0)

    ;(async () => {
      try {
        const iuIds = mappedUnits.map(u => u.id)
        let supplyTotal = 0
        if (iuIds.length > 0) {
          const { data: srItems } = await supabaseClient
            .from('supply_run_items')
            .select('total_cost, unit_cost, quantity, supply_run:supply_runs!inner(incident_unit_id)')
            .in('supply_run.incident_unit_id', iuIds)
          supplyTotal = ((srItems as any[]) || []).reduce((sum: number, item: any) => {
            const line = item.total_cost ?? ((item.unit_cost ?? 0) * (item.quantity ?? 1))
            return sum + (line ?? 0)
          }, 0)
        }

        const { data: encIds } = await supabaseClient
          .from('patient_encounters')
          .select('encounter_id')
          .eq('incident_id', activeIncidentId)
          .is('deleted_at', null)
        const ids = ((encIds as any[]) || []).map((e: any) => e.encounter_id)
        let marTotal = 0
        if (ids.length > 0) {
          const { data: marCostData } = await supabaseClient
            .from('dispense_admin_log')
            .select('qty_used, formulary:formulary_templates(catalog_item:item_catalog(case_cost, units_per_case))')
            .in('encounter_id', ids)
          marTotal = ((marCostData as any[]) || []).reduce((sum: number, row: any) => {
            const cat = row.formulary?.catalog_item
            const ci = Array.isArray(cat) ? cat[0] : cat
            const unitCost = ci?.case_cost != null && ci?.units_per_case > 0
              ? ci.case_cost / ci.units_per_case
              : 0
            return sum + unitCost * (row.qty_used ?? 1)
          }, 0)
        }

        setBillingTotal(supplyTotal + marTotal)
      } catch {
        setBillingTotal(0)
      }
    })()

    ;(async () => {
      try {
        if (assignedUnitIds.length === 0) { setReorderCount(0); return }
        const scopedUnitIds = !isAdmin && assignmentUnit?.id
          ? assignedUnitIds.filter(uid => uid === assignmentUnit!.id)
          : assignedUnitIds
        if (scopedUnitIds.length === 0) { setReorderCount(0); return }
        const { data: allIuData } = await supabaseClient
          .from('incident_units')
          .select('id')
          .in('unit_id', scopedUnitIds)
        const allIuIds = ((allIuData as any[]) || []).map((r: any) => r.id)
        if (allIuIds.length === 0) { setReorderCount(0); return }
        const { data: invData } = await supabaseClient
          .from('unit_inventory')
          .select('id, quantity, par_qty')
          .in('incident_unit_id', allIuIds)
        const low = ((invData as any[]) || []).filter((row: any) =>
          row.par_qty != null && row.quantity <= row.par_qty
        )
        setReorderCount(low.length)

        if (allIuIds.length > 0) {
          const { data: reorderData } = await supabaseClient
            .from('unit_inventory')
            .select('id, item_name, quantity, par_qty, incident_unit_id, catalog_item_id')
            .in('incident_unit_id', allIuIds)
            .lte('quantity', supabaseClient.rpc ? 0 : 999999)
          const iuToUnit = new Map<string, string>()
          for (const iu of mappedUnits) {
            if (iu.unit) iuToUnit.set(iu.id, (iu.unit as any)?.name || '?')
          }
          if (allIuData) {
            for (const iu of (allIuData as any[])) {
              if (!iuToUnit.has(iu.id)) {
                const matchedUnit = allUnitsData?.find((u: any) => mappedUnits.some(mu => mu.id === iu.id))
                if (matchedUnit) iuToUnit.set(iu.id, (matchedUnit as any).name || '?')
              }
            }
          }
          const rows = ((reorderData as any[]) || [])
            .filter((r: any) => r.par_qty != null && r.quantity <= r.par_qty)
            .map((r: any) => ({
              id: r.id,
              item_name: r.item_name || '?',
              quantity: r.quantity ?? 0,
              par_qty: r.par_qty ?? 0,
              unit_name: iuToUnit.get(r.incident_unit_id) || '?',
            }))
            .sort((a: any, b: any) => a.quantity - b.quantity)
          setReorderRows(rows.slice(0, 100))
        }
      } catch {
        setReorderCount(0)
        setReorderRows([])
      }
    })()

    ;(async () => {
      try {
        const { data } = await supabaseClient
          .from('incident_expenses')
          .select('id, expense_type, amount, description, expense_date, unit_id, employee_id, created_by, receipt_url, no_receipt_reason, employees(name)')
          .eq('incident_id', activeIncidentId)
          .order('expense_date', { ascending: false })
          .limit(100)
        setExpenses((data as any[]) || [])
      } catch { setExpenses([]) }
    })()

    ;(async () => {
      try {
        const { data: ics214Data } = await supabaseClient
          .from('ics214_headers')
          .select('ics214_id, unit_name, op_date, status')
          .eq('incident_id', activeIncidentId)
          .order('created_at', { ascending: false })
          .limit(5)
        setIcs214Rows((ics214Data as ICS214Row[]) || [])
      } catch {
        setIcs214Rows([])
      }
    })()

    ;(async () => {
      try {
        const { data: allIUData } = await supabaseClient
          .from('incident_units')
          .select('id, units(name), released_at')
          .eq('incident_id', activeIncidentId)
        const allIUs = ((allIUData || []) as unknown as { id: string; units: { name: string } | { name: string }[] | null; released_at: string | null }[]).map(iu => ({
          id: iu.id,
          unitName: Array.isArray(iu.units) ? iu.units[0]?.name || '?' : iu.units?.name || '?',
          released_at: iu.released_at,
        }))
        const allIUIds = allIUs.map(iu => iu.id)

        const [{ data: uaData }, { data: depData }, { data: empData }] = await Promise.all([
          allIUIds.length > 0
            ? supabaseClient
                .from('unit_assignments')
                .select('id, employee_id, incident_unit_id, assigned_at, released_at, daily_rate_override, hours_per_day, travel_date, check_in_at, check_out_at, notes, employees(id, name, role, daily_rate, default_hours_per_day, headshot_url)')
                .in('incident_unit_id', allIUIds)
            : Promise.resolve({ data: [] }),
          supabaseClient
            .from('deployment_records')
            .select('id, employee_id, travel_date, check_in_date, check_out_date, daily_rate, status, notes, employees(name, role)')
            .eq('incident_id', activeIncidentId)
            .order('travel_date', { ascending: false }),
          supabaseClient
            .from('employees')
            .select('id, name, role, daily_rate')
            .eq('status', 'Active')
            .order('name'),
        ])

        setDeployments((depData as unknown as DeploymentRecord[]) ?? [])
        setAllEmployees((empData as Employee[]) ?? [])

        const depByEmployee = new Map<string, any>()
        for (const dep of (depData || [])) {
          depByEmployee.set((dep as any).employee_id, dep)
        }

        const iuMap = new Map<string, { unitName: string; released: string | null }>()
        for (const iu of allIUs) {
          iuMap.set(iu.id, { unitName: iu.unitName, released: iu.released_at })
        }

        const merged: CrewDeployment[] = ((uaData || []) as any[]).map(ua => {
          const emp = ua.employees || {}
          const iu = iuMap.get(ua.incident_unit_id)
          const dep = depByEmployee.get(ua.employee_id)
          const rate = ua.daily_rate_override ?? dep?.daily_rate ?? emp.daily_rate ?? 0
          const hours = ua.hours_per_day ?? emp.default_hours_per_day ?? 16
          return {
            assignment_id: ua.id,
            employee_id: ua.employee_id,
            employee_name: emp.name || '?',
            employee_role: emp.role || '?',
            employee_headshot_url: emp.headshot_url || null,
            unit_name: iu?.unitName || '?',
            daily_rate: rate,
            hours_per_day: hours,
            released_at: ua.released_at || iu?.released || null,
            assigned_at: ua.assigned_at || null,
            deployment_id: dep?.id || null,
            travel_date: ua.travel_date || dep?.travel_date || null,
            check_in_at: ua.check_in_at || dep?.checked_in_at || null,
            check_out_at: ua.check_out_at || dep?.checked_out_at || null,
            deploy_status: ua.released_at ? 'Released' : (dep?.status || 'On Scene'),
            notes: ua.notes || dep?.notes || null,
          }
        })
        merged.sort((a, b) => {
          if (!a.released_at && b.released_at) return -1
          if (a.released_at && !b.released_at) return 1
          return a.employee_name.localeCompare(b.employee_name)
        })
        setCrewDeployments(merged)
      } catch {
        setDeployments([])
        setCrewDeployments([])
      }
    })()

    setLoading(false)
  }, [activeIncidentId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const saveField = useCallback(async (key: string, value: string) => {
    if (!incident) return
    await incidentService.updateIncident(activeIncidentId, { [key]: value || null })
    setIncident(prev => prev ? { ...prev, [key]: value || null } : prev)
  }, [incident, activeIncidentId])

  const patchIncident = useCallback((fields: Partial<Incident>) => {
    setIncident(prev => prev ? { ...prev, ...fields } : prev)
  }, [])

  return {
    incident,
    incidentUnits,
    allIncidentUnits,
    allUnits,
    activeIncidents,
    currentUserId,
    encounterCount,
    encounters,
    marCount,
    marEntries,
    compCount,
    compRows,
    supplyCount,
    supplyRuns,
    crewDeployments,
    deployments,
    allEmployees,
    billingTotal,
    reorderCount,
    reorderRows,
    ics214Rows,
    expenses,
    loading,
    isOfflineData,
    reload: load,
    saveField,
    patchIncident,
  }
}
