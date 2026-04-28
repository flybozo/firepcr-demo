import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { queryActiveIncidentsForEncounters } from '@/lib/services/encounters'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { PageHeader, LoadingSkeleton, EmptyState, UnitFilterPills, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { getUnitTypeName } from '@/lib/unitColors'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'
import { generate214PDF } from '@/lib/generate214pdf'
import { uploadSignatureDataUrl } from '@/lib/signatureUtils'
import type { Activity, PatientEncounter } from './components/types'
import { useICS214Data } from './components/useICS214Data'
import { HeaderCard } from './components/HeaderCard'
import { PersonnelSection } from './components/PersonnelSection'
import { ActivityLog } from './components/ActivityLog'
import { CloseoutModal } from './components/CloseoutModal'
import { PDFSection } from './components/PDFSection'

type ICS214Row = {
  id: string
  ics214_id: string
  incident_name: string
  unit_name: string
  op_date: string
  op_start: string
  op_end: string
  leader_name: string
  status: 'Open' | 'Closed'
  created_at: string
}

// ── Embedded Detail ───────────────────────────────────────────────────────────

function ICS214EmbeddedDetail({ ics214Id }: { ics214Id: string }) {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const { header, setHeader, activities, setActivities, personnel, loading, load, saveField, addActivity, addPersonnel } =
    useICS214Data(ics214Id, assignment)

  const [showCloseout, setShowCloseout] = useState(false)
  const [closingOut, setClosingOut] = useState(false)
  const [encounters, setEncounters] = useState<PatientEncounter[]>([])
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)

  const openCloseout = async () => {
    if (!header) return
    const { data } = await supabase
      .from('patient_encounters')
      .select('id, patient_last_name, patient_first_name, chief_complaint, disposition, encounter_id')
      .eq('incident_id', header.incident_id)
      .eq('unit', header.unit_name)
      .gte('date', header.op_date)
      .lte('date', header.op_date)
    setEncounters((data as PatientEncounter[]) || [])
    setShowCloseout(true)
  }

  const confirmCloseout = async (sigDataUrl: string | null) => {
    if (!header) return
    setClosingOut(true)
    const loggedBy = assignment.employee?.name || assignment.user?.email || 'Unknown'

    const patientActivities = encounters.map(enc => ({
      ics214_id: ics214Id,
      log_datetime: new Date().toISOString(),
      description: `PATIENT CONTACT — ${enc.patient_first_name?.[0] ?? '?'}${enc.patient_last_name?.[0] ?? '?'} | CC: ${enc.chief_complaint || 'Unknown'} | Disposition: ${enc.disposition || 'Unknown'} | PCR: ${enc.encounter_id || enc.id}`,
      logged_by: loggedBy,
      activity_type: 'patient_contact' as const,
    }))

    if (patientActivities.length > 0) {
      await supabase.from('ics214_activities').insert(patientActivities)
    }

    const sigStoragePath = sigDataUrl
      ? await uploadSignatureDataUrl(supabase, sigDataUrl, `ics214/${ics214Id}-leader-sig.png`, { upsert: true })
      : null

    await supabase.from('ics214_headers').update({
      status: 'Closed',
      closed_at: new Date().toISOString(),
      closed_by: loggedBy,
      leader_signature_url: sigStoragePath,
    } as any).eq('ics214_id', ics214Id)

    setShowCloseout(false)
    setClosingOut(false)
    await load()
    setTimeout(() => generateAndUploadPDF(null), 500)
  }

  const generateAndUploadPDF = async (directSigDataUrl?: string | null) => {
    if (!header) return
    setGeneratingPDF(true)
    try {
      const { data: freshActivities } = await supabase
        .from('ics214_activities').select('*').eq('ics214_id', ics214Id).order('log_datetime')

      let leaderSigDataUrl: string | null = directSigDataUrl || null
      if (!leaderSigDataUrl && (header as any).leader_signature_url) {
        try {
          const { data: sigSigned } = await supabase.storage.from('signatures')
            .createSignedUrl((header as any).leader_signature_url, 300)
          if (sigSigned?.signedUrl) {
            const resp = await fetch(sigSigned.signedUrl)
            const blob = await resp.blob()
            leaderSigDataUrl = await new Promise((res) => {
              const reader = new FileReader()
              reader.onloadend = () => res(reader.result as string)
              reader.readAsDataURL(blob)
            })
          }
        } catch {}
      }

      const doc = await generate214PDF(
        { ics214_id: header.ics214_id, incident_name: header.incident_name, unit_name: header.unit_name,
          op_date: header.op_date, op_start: header.op_start, op_end: header.op_end,
          leader_name: header.leader_name, leader_position: header.leader_position, leader_signature_url: leaderSigDataUrl },
        personnel,
        (freshActivities as Activity[]) || activities
      )

      doc.save(`${header.ics214_id}.pdf`)
      const path = `ics214/${header.ics214_id}.pdf`
      await supabase.storage.from('documents').upload(path, doc.output('blob'), { contentType: 'application/pdf', upsert: true })
      await supabase.from('ics214_headers').update({ pdf_url: path, pdf_file_name: `${header.ics214_id}.pdf` }).eq('ics214_id', ics214Id)
      setHeader(prev => prev ? { ...prev, pdf_url: path, pdf_file_name: `${header.ics214_id}.pdf` } : prev)
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
      if (signed?.signedUrl) setSignedPdfUrl(signed.signedUrl)
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
    setGeneratingPDF(false)
  }

  if (loading) return <LoadingSkeleton panel />

  if (!header) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p className="text-sm">ICS 214 not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
      <div className="space-y-4">
        <HeaderCard header={header} onSave={saveField} />
        <PersonnelSection personnel={personnel} onAdd={addPersonnel} />
        <ActivityLog activities={activities} header={header} ics214IdParam={ics214Id} onAddActivity={addActivity} />
        {header.status === 'Open' && (
          <button onClick={openCloseout} className="w-full py-3 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-bold transition-colors border border-red-600">
            🔒 Close Out ICS 214
          </button>
        )}
        {header.status === 'Closed' && (
          <PDFSection header={header} signedPdfUrl={signedPdfUrl} generatingPDF={generatingPDF} onRegenerate={() => generateAndUploadPDF()} />
        )}
      </div>
      {showCloseout && (
        <CloseoutModal header={header} encounters={encounters} closingOut={closingOut} onConfirm={confirmCloseout} onCancel={() => setShowCloseout(false)} />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ICS214ListPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment?.employee?.role || '')

  const [rows, setRows] = useState<ICS214Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  type ICS214SortKey = 'op_date' | 'unit_name' | 'incident_name'
  const { sortKey: icsSortKey, sortDir: icsSortDir, toggleSort: icsToggleSort, sortFn: icsSortFn } = useSortable<ICS214SortKey>('op_date', 'desc')
  const [unitFilter, setUnitFilter] = useState<string>('All')
  const [incidentFilter, setIncidentFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [dateRange, setDateRange] = useState('7d')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])
  const [units, setUnits] = useState<string[]>([])
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)

  useEffect(() => {
    if (assignment.loading) return
    if (!isAdmin && assignment.unit?.name) {
      setUnitFilter(assignment.unit.name)
    }
  }, [assignment.loading, isAdmin, assignment.unit?.name])

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 86400000).toISOString()

  useEffect(() => {
    if (assignment.loading) return
    load()
  }, [unitFilter, incidentFilter, statusFilter, dateRange, assignment.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true)
    try {
      if (isAdmin && activeIncidents.length === 0) {
        const { data: incs, error: incErr } = await queryActiveIncidentsForEncounters()
        if (incErr) throw incErr
        setActiveIncidents(incs || [])
      }
      let q = supabase
        .from('ics214_headers')
        .select('id, ics214_id, incident_name, unit_name, op_date, op_start, op_end, leader_name, status, created_at')
        .order('created_at', { ascending: false })

      const effectiveUnit = !isAdmin && assignment.unit?.name ? assignment.unit.name : unitFilter
      if (effectiveUnit && effectiveUnit !== 'All') q = q.eq('unit_name', effectiveUnit)
      if (isAdmin && incidentFilter !== 'All') q = (q as any).eq('incident_id', incidentFilter)
      if (statusFilter !== 'All') q = q.eq('status', statusFilter)
      if (dateFilter) q = q.gte('created_at', dateFilter)

      const { data, error } = await q
      if (error) throw error
      const fetchedRows = (data as ICS214Row[]) || []
      fetchedRows.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
      setRows(fetchedRows)
      const allUnits = Array.from(new Set(fetchedRows.map(r => r.unit_name).filter(Boolean)))
      setUnits(allUnits)
    } catch {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('ics214s')
        const sorted = [...cached].sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
        setRows(sorted as ICS214Row[])
      } catch { setRows([]) }
    }
    setLoading(false)
  }

  const sortedRows = icsSortFn(rows, (r, key) => {
    if (key === 'op_date') return r.op_date ?? ''
    if (key === 'unit_name') return r.unit_name ?? ''
    if (key === 'incident_name') return r.incident_name ?? ''
    return ''
  })

  const selectedRow = selectedId ? rows.find(r => r.id === selectedId) ?? null : null

  return (
    <div className="bg-gray-950 text-white h-full flex flex-col">

      {/* Header + filters — full width, flex-shrink-0 */}
      <div className="flex-shrink-0 p-4 md:px-6 md:pt-6 space-y-3">
        <PageHeader
          title="ICS 214 Logs"
          actions={
            <Link
              to="/ics214/new"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
            >
              + New 214
            </Link>
          }
        />

        {/* Date range */}
        <div className="hidden md:flex gap-1.5">
          {(['7d', '30d', '90d', 'All'] as const).map(range => (
            <button key={range} onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="90d">90 Days</option>
          <option value="All">All Time</option>
        </select>

        {/* Incident + unit + status filters */}
        <div className="flex flex-col gap-2">
          {isAdmin && activeIncidents.length > 0 && (
            <>
              <div className="hidden md:flex gap-1.5 flex-wrap">
                <button onClick={() => setIncidentFilter('All')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${incidentFilter === 'All' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  All Incidents
                </button>
                {activeIncidents.map((inc, i) => (
                  <button key={inc.id} onClick={() => setIncidentFilter(inc.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      incidentFilter === inc.id
                        ? ['bg-teal-700 text-white','bg-amber-700 text-white','bg-indigo-700 text-white'][i % 3]
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    🔥 {inc.name}
                  </button>
                ))}
              </div>
              <select
                value={incidentFilter}
                onChange={e => setIncidentFilter(e.target.value)}
                className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="All">All Incidents</option>
                {activeIncidents.map(inc => (
                  <option key={inc.id} value={inc.id}>🔥 {inc.name}</option>
                ))}
              </select>
            </>
          )}
          {isAdmin ? (
            <UnitFilterPills
              units={units}
              selected={unitFilter}
              onSelect={setUnitFilter}
              unitTypeMap={Object.fromEntries(units.map(u => [u, getUnitTypeName(u)]))}
            />
          ) : (
            <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit?.name || '—'}</span>
          )}
          <div className="flex flex-wrap gap-2">
            {(['All', 'Open', 'Closed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? s === 'Open' ? 'bg-green-700 text-white' : s === 'Closed' ? 'bg-gray-600 text-white' : 'bg-red-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex-1 flex min-h-0 border-t border-gray-800">

        {/* Left: compact list (40%) */}
        <div className="w-full md:w-[40%] md:border-r border-gray-800 overflow-y-auto">
          {loading ? (
            <LoadingSkeleton panel />
          ) : sortedRows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="📋"
                message="No ICS 214 logs found."
                actionHref="/ics214/new"
                actionLabel="Create your first 214 →"
              />
            </div>
          ) : (
            <div className="p-3">
              <div className={lc.container}>
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2 ${lc.header}`}>
                <div className="w-24">
                  <SortableHeader label="Date" sortKey="op_date" currentKey={icsSortKey} currentDir={icsSortDir} onToggle={icsToggleSort} />
                </div>
                <div className="w-24">
                  <SortableHeader label="Unit" sortKey="unit_name" currentKey={icsSortKey} currentDir={icsSortDir} onToggle={icsToggleSort} />
                </div>
                <div className="flex-1">
                  <SortableHeader label="Incident" sortKey="incident_name" currentKey={icsSortKey} currentDir={icsSortDir} onToggle={icsToggleSort} />
                </div>
                <div className="w-16 text-right">
                  <span className="text-xs text-gray-500 font-medium">Status</span>
                </div>
              </div>

              {/* Rows */}
              <div>
                {sortedRows.map(row => {
                  const isSelected = row.id === selectedId
                  return (
                    <button
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 ${lc.rowCls(isSelected)}`}
                    >
                      <span className="w-24 text-xs font-mono text-gray-400 flex-shrink-0 truncate">
                        {row.op_date || '—'}
                      </span>
                      <span className={`w-24 text-xs flex-shrink-0 truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {row.unit_name || '—'}
                      </span>
                      <span className="flex-1 text-xs text-gray-400 truncate min-w-0">
                        {row.incident_name || '—'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                        row.status === 'Open' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {row.status}
                      </span>
                    </button>
                  )
                })}
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: full detail (60%) — desktop only */}
        <div className="hidden md:flex md:w-[60%] overflow-y-auto">
          {selectedRow ? (
            <ICS214EmbeddedDetail ics214Id={selectedRow.ics214_id} />
          ) : (
            <div className="flex items-center justify-center w-full text-gray-600">
              <div className="text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">Select an item to view details</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Mobile overlay */}
      {selectedRow && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-950 flex flex-col">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-bold text-white">ICS 214 Detail</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-white text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ICS214EmbeddedDetail ics214Id={selectedRow.ics214_id} />
          </div>
        </div>
      )}

    </div>
  )
}
