

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import SignatureCanvas from 'react-signature-canvas'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { generate214PDF } from '@/lib/generate214pdf'

type ICS214Header = {
  id: string
  ics214_id: string
  incident_id: string
  incident_name: string
  unit_id: string
  unit_name: string
  op_date: string
  op_start: string
  op_end: string
  leader_name: string
  leader_position: string
  status: 'Open' | 'Closed'
  pdf_url: string | null
  pdf_file_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  closed_at: string | null
  closed_by: string | null
}

type Activity = {
  id: string
  ics214_id: string
  log_datetime: string
  description: string
  logged_by: string
  activity_type: 'activity' | 'patient_contact' | 'system'
}

type Personnel = {
  id: string
  ics214_id: string
  employee_name: string
  ics_position: string
  home_agency: string
}

type PatientEncounter = {
  id: string
  patient_last_name: string | null
  patient_first_name: string | null
  chief_complaint: string | null
  disposition: string | null
  encounter_id: string | null
}

// Inline edit field
function EditField({
  label,
  value,
  fieldKey,
  type = 'text',
  onSave,
  readOnly = false,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  type?: string
  onSave: (key: string, val: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave(fieldKey, draft)
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm text-gray-300">{value || '—'}</span>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-gray-500">{label}</span>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex flex-col gap-0.5 text-left group w-full hover:bg-gray-800/50 rounded-md px-1.5 py-1 transition-colors"
    >
      <span className="text-xs text-gray-500 group-hover:text-gray-400">{label}</span>
      <span className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
        {value || 'Click to edit'}
      </span>
    </button>
  )
}

function formatTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return isoStr
  }
}

function formatDateTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return isoStr
  }
}

export default function ICS214DetailPage() {
  const supabase = createClient()
  const params = useParams()
  const ics214IdParam = params.id as string
  const assignment = useUserAssignment()

  const [header, setHeader] = useState<ICS214Header | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)

  // Add activity form
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [actDateTime, setActDateTime] = useState('')
  const [actDescription, setActDescription] = useState('')
  const [submittingActivity, setSubmittingActivity] = useState(false)

  // Add personnel form
  const [showAddPersonnel, setShowAddPersonnel] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonPos, setNewPersonPos] = useState('')
  const [newPersonAgency, setNewPersonAgency] = useState('Remote Area Medicine')

  // Closeout
  const [showCloseout, setShowCloseout] = useState(false)
  const closeoutSigRef = useRef<SignatureCanvas>(null)
  const [closingOut, setClosingOut] = useState(false)
  const [encounters, setEncounters] = useState<PatientEncounter[]>([])

  // PDF
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)

  // Generate a signed URL for the private documents bucket
  const fetchSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
    if (data?.signedUrl) setSignedPdfUrl(data.signedUrl)
    else console.error('Signed URL error:', error)
  }

  const load = async () => {
    try {
      const [{ data: hData }, { data: aData }, { data: pData }] = await Promise.all([
        supabase.from('ics214_headers').select('*').eq('ics214_id', ics214IdParam).single(),
        supabase.from('ics214_activities').select('*').eq('ics214_id', ics214IdParam).order('log_datetime'),
        supabase.from('ics214_personnel').select('*').eq('ics214_id', ics214IdParam),
      ])
      setHeader(hData as ICS214Header | null)
      setActivities((aData as Activity[]) || [])
      setPersonnel((pData as Personnel[]) || [])
    } catch {
      // Offline — load from IndexedDB
      const { getCachedData } = await import('@/lib/offlineStore')
      const cachedHeaders = await getCachedData('ics214s')
      const h = cachedHeaders.find((h: any) => h.ics214_id === ics214IdParam || h.id === ics214IdParam)
      if (h) setHeader(h as ICS214Header)
      const cachedActs = await getCachedData('ics214_activities')
      setActivities(cachedActs.filter((a: any) => a.ics214_id === ics214IdParam) as Activity[])
      const cachedPers = await getCachedData('ics214_personnel')
      setPersonnel(cachedPers.filter((p: any) => p.ics214_id === ics214IdParam) as Personnel[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [ics214IdParam])

  // Default activity datetime to now
  useEffect(() => {
    if (showAddActivity) {
      const now = new Date()
      now.setSeconds(0, 0)
      setActDateTime(now.toISOString().slice(0, 16))
    }
  }, [showAddActivity])

  const saveField = async (key: string, value: string) => {
    if (!header) return
    await supabase.from('ics214_headers').update({ [key]: value || null }).eq('ics214_id', ics214IdParam)
    setHeader(prev => prev ? { ...prev, [key]: value || null } : prev)
  }

  const addActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actDescription.trim()) return
    setSubmittingActivity(true)
    const { getIsOnline } = await import('@/lib/syncManager')
    const { queueOfflineWrite } = await import('@/lib/offlineStore')
    const activityData = {
      ics214_id: ics214IdParam,
      log_datetime: actDateTime ? new Date(actDateTime).toISOString() : new Date().toISOString(),
      description: actDescription.trim(),
      logged_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
      activity_type: 'activity',
    }
    if (getIsOnline()) {
      const { data } = await supabase.from('ics214_activities').insert(activityData).select().single()
      if (data) setActivities(prev => [...prev, data as Activity].sort((a, b) => a.log_datetime.localeCompare(b.log_datetime)))
    } else {
      const offlineEntry = { id: crypto.randomUUID(), ...activityData }
      await queueOfflineWrite('ics214_activities', 'insert', offlineEntry)
      setActivities(prev => [...prev, offlineEntry as unknown as Activity].sort((a, b) => a.log_datetime.localeCompare(b.log_datetime)))
    }
    setActDescription('')
    setShowAddActivity(false)
    setSubmittingActivity(false)
  }

  const addPersonnel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPersonName.trim()) return
    const { data } = await supabase.from('ics214_personnel').insert({
      ics214_id: ics214IdParam,
      employee_name: newPersonName.trim(),
      ics_position: newPersonPos.trim(),
      home_agency: newPersonAgency.trim(),
    }).select().single()
    if (data) setPersonnel(prev => [...prev, data as Personnel])
    setNewPersonName('')
    setNewPersonPos('')
    setNewPersonAgency('Remote Area Medicine')
    setShowAddPersonnel(false)
  }

  const openCloseout = async () => {
    if (!header) return
    // Fetch patient encounters for this unit + incident on this op date
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

  const confirmCloseout = async () => {
    if (!header) return
    setClosingOut(true)

    // 1. Create patient_contact activity entries (de-identified)
    const patientActivities = encounters.map(enc => {
      const first = enc.patient_first_name?.[0] ?? '?'
      const last = enc.patient_last_name?.[0] ?? '?'
      const initials = `${first}${last}`
      const cc = enc.chief_complaint || 'Unknown'
      const disp = enc.disposition || 'Unknown'
      const pcr = enc.encounter_id || enc.id

      return {
        ics214_id: ics214IdParam,
        log_datetime: new Date().toISOString(),
        description: `PATIENT CONTACT — ${initials} | CC: ${cc} | Disposition: ${disp} | PCR: ${pcr}`,
        logged_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
        activity_type: 'patient_contact' as const,
      }
    })

    if (patientActivities.length > 0) {
      await supabase.from('ics214_activities').insert(patientActivities)
    }

    // 2. Upload signature if drawn
    let sigStoragePath: string | null = null
    let capturedSigDataUrl: string | null = null
    if (closeoutSigRef.current && !closeoutSigRef.current.isEmpty()) {
      capturedSigDataUrl = closeoutSigRef.current.getTrimmedCanvas().toDataURL('image/png')
      const sigBlob = await (await fetch(capturedSigDataUrl)).blob()
      const sigPath = `ics214/${ics214IdParam}-leader-sig.png`
      const { error: sigErr } = await supabase.storage.from('signatures').upload(sigPath, sigBlob, { contentType: 'image/png', upsert: true })
      if (!sigErr) sigStoragePath = sigPath
    }

    // 3. Close out header
    await supabase.from('ics214_headers').update({
      status: 'Closed',
      closed_at: new Date().toISOString(),
      closed_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
      leader_signature_url: sigStoragePath,
    } as any).eq('ics214_id', ics214IdParam)

    setShowCloseout(false)
    setClosingOut(false)

    // Reload then generate PDF
    await load()

    // Trigger PDF generation — pass sigDataUrl directly so it doesn't need to re-fetch from storage
    setTimeout(() => generateAndUploadPDF(capturedSigDataUrl), 500)
  }

  const generateAndUploadPDF = async (directSigDataUrl?: string | null) => {
    if (!header) return
    setGeneratingPDF(true)
    try {
      const { data: freshActivities } = await supabase
        .from('ics214_activities')
        .select('*')
        .eq('ics214_id', ics214IdParam)
        .order('log_datetime')

      // Use directly passed sig dataUrl (fresh from canvas) or fetch from storage
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

      const doc = generate214PDF(
        {
          ics214_id: header.ics214_id,
          incident_name: header.incident_name,
          unit_name: header.unit_name,
          op_date: header.op_date,
          op_start: header.op_start,
          op_end: header.op_end,
          leader_name: header.leader_name,
          leader_position: header.leader_position,
          leader_signature_url: leaderSigDataUrl,
        },
        personnel,
        (freshActivities as Activity[]) || activities
      )

      // Download
      doc.save(`${header.ics214_id}.pdf`)

      // Upload to Supabase storage
      const pdfBlob = doc.output('blob')
      const path = `ics214/${header.ics214_id}.pdf`
      await supabase.storage.from('documents').upload(path, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      })
      // Store path (not public URL — bucket is private, use signed URLs)
      await supabase.from('ics214_headers').update({
        pdf_url: path,   // storage path
        pdf_file_name: `${header.ics214_id}.pdf`,
      }).eq('ics214_id', ics214IdParam)

      setHeader(prev => prev ? {
        ...prev,
        pdf_url: path,
        pdf_file_name: `${header.ics214_id}.pdf`,
      } : prev)
      // Get fresh signed URL
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
      if (signed?.signedUrl) setSignedPdfUrl(signed.signedUrl)
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
    setGeneratingPDF(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!header) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">ICS 214 not found.</p>
          <Link to="/ics214" className="text-red-400 underline text-sm">← All 214 Logs</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-4xl mx-auto p-4 md:p-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-5 pt-2 flex-wrap">
          <Link to="/ics214" className="text-gray-500 hover:text-white text-sm">← ICS 214 Logs</Link>
          <span className="text-gray-700">/</span>
          <span className="font-mono text-sm text-gray-300">{header.ics214_id}</span>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
            header.status === 'Open' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
          }`}>
            {header.status}
          </span>
        </div>

        <div className="space-y-4">

          {/* Header Card */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">ICS 214 Header</h2>
              <span className="text-xs text-gray-600 italic">Click to edit</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <EditField label="214 ID" value={header.ics214_id} fieldKey="ics214_id" onSave={saveField} readOnly />
                <EditField label="Status" value={header.status} fieldKey="status" onSave={saveField} readOnly />
                <EditField label="Incident" value={header.incident_name} fieldKey="incident_name" onSave={saveField} />
                <EditField label="Unit" value={header.unit_name} fieldKey="unit_name" onSave={saveField} />
                <EditField label="Op Date" value={header.op_date} fieldKey="op_date" type="date" onSave={saveField} />
                <EditField label="Op Start" value={header.op_start} fieldKey="op_start" type="time" onSave={saveField} />
                <EditField label="Op End" value={header.op_end} fieldKey="op_end" type="time" onSave={saveField} />
                <EditField label="Leader Name" value={header.leader_name} fieldKey="leader_name" onSave={saveField} />
                <EditField label="Leader ICS Position" value={header.leader_position} fieldKey="leader_position" onSave={saveField} />
              </div>
              {/* Notes */}
              <div className="mt-3 pt-3 border-t border-gray-800">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea
                  defaultValue={header.notes ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (header.notes ?? '')) saveField('notes', e.target.value)
                  }}
                  rows={2}
                  className="w-full bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                />
              </div>
              {header.closed_at && (
                <p className="mt-2 text-xs text-gray-600">
                  Closed {formatDateTime(header.closed_at)} by {header.closed_by}
                </p>
              )}
            </div>
          </div>

          {/* Personnel Section */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Personnel ({personnel.length})
              </h2>
              <button
                onClick={() => setShowAddPersonnel(v => !v)}
                className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                {showAddPersonnel ? '✕' : '+ Add Person'}
              </button>
            </div>
            <p className="px-4 pt-2 text-xs text-gray-600 italic">
              Snapshot taken at creation. To update, add manually.
            </p>

            {showAddPersonnel && (
              <form onSubmit={addPersonnel} className="px-4 py-3 border-b border-gray-800 bg-gray-800/30 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={e => setNewPersonName(e.target.value)}
                    placeholder="Name"
                    required
                    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <input
                    type="text"
                    value={newPersonPos}
                    onChange={e => setNewPersonPos(e.target.value)}
                    placeholder="ICS Position"
                    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <input
                    type="text"
                    value={newPersonAgency}
                    onChange={e => setNewPersonAgency(e.target.value)}
                    placeholder="Home Agency"
                    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
                  Add Person
                </button>
              </form>
            )}

            {personnel.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-600 text-center">No personnel on record.</p>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {/* Header row */}
                <div className="flex px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 bg-gray-800/30">
                  <span className="flex-1">Name</span>
                  <span className="w-36 hidden sm:block">ICS Position</span>
                  <span className="w-40 hidden sm:block">Home Agency</span>
                </div>
                {personnel.map(p => (
                  <div key={p.id} className="flex items-center px-4 py-2 text-sm">
                    <span className="flex-1 text-white">{p.employee_name}</span>
                    <span className="w-36 text-gray-400 text-xs hidden sm:block">{p.ics_position || '—'}</span>
                    <span className="w-40 text-gray-500 text-xs hidden sm:block">{p.home_agency || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Activity Log ({activities.filter(a => a.activity_type !== 'system').length} entries)
              </h2>
              {header.status === 'Open' && (
                <Link
                  to={`/ics214/${ics214IdParam}/activity`}
                  className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  + Add Activity
                </Link>
              )}
            </div>

            {activities.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-600 text-center">No activities logged yet.</p>
            ) : (
              <div className="divide-y divide-gray-800/40 max-h-[500px] overflow-y-auto">
                {activities.map(act => (
                  <div
                    key={act.id}
                    className={`flex gap-3 px-4 py-3 ${
                      act.activity_type === 'patient_contact'
                        ? 'bg-amber-950/30 border-l-2 border-amber-600'
                        : act.activity_type === 'system'
                        ? 'bg-gray-800/20'
                        : ''
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${
                        act.activity_type === 'patient_contact'
                          ? 'bg-amber-900 text-amber-300'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {formatTime(act.log_datetime)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${act.activity_type === 'patient_contact' ? 'text-amber-100 font-semibold' : 'text-white'}`}>
                        {act.description}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">{act.logged_by}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inline add activity */}
            {header.status === 'Open' && (
              <div className="border-t border-gray-800 p-4">
                {!showAddActivity ? (
                  <button
                    onClick={() => setShowAddActivity(true)}
                    className="w-full py-2 border border-dashed border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    + Add Activity Entry
                  </button>
                ) : (
                  <form onSubmit={addActivity} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={actDateTime}
                          onChange={e => setActDateTime(e.target.value)}
                          className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={actDescription}
                        onChange={e => setActDescription(e.target.value)}
                        required
                        rows={3}
                        placeholder="Describe the activity..."
                        className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submittingActivity}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
                      >
                        {submittingActivity ? 'Logging...' : 'Log Activity'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAddActivity(false); setActDescription('') }}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Close Out Button */}
          {header.status === 'Open' && (
            <button
              onClick={openCloseout}
              className="w-full py-3 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-bold transition-colors border border-red-600"
            >
              🔒 Close Out ICS 214
            </button>
          )}

          {/* PDF Section (Closed) */}
          {header.status === 'Closed' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">PDF Document</p>
                {signedPdfUrl ? (
                  <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                    {header.pdf_file_name || 'View PDF'}
                  </a>
                ) : header.pdf_url ? (
                  <p className="text-xs text-yellow-500">Loading link...</p>
                ) : (
                  <p className="text-xs text-gray-600">No PDF yet — click Generate</p>
                )}
              </div>
              {signedPdfUrl && (
                <a
                  href={signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-semibold transition-colors"
                >
                  📄 Download PDF
                </a>
              )}
              <button
                onClick={() => generateAndUploadPDF()}
                disabled={generatingPDF}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg text-xs font-semibold transition-colors"
              >
                {generatingPDF ? 'Generating...' : '🔄 Regenerate PDF'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Closeout Modal */}
      {showCloseout && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">🔒 Close Out ICS 214</h2>
            <p className="text-sm text-gray-400">
              This will finalize the {header.ics214_id} log. The following patient encounters will be logged (de-identified):
            </p>

            {encounters.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No patient encounters found for this unit/incident/date.</p>
            ) : (
              <div className="bg-gray-800 rounded-lg divide-y divide-gray-700 max-h-48 overflow-y-auto">
                {encounters.map(enc => {
                  const initials = `${enc.patient_first_name?.[0] ?? '?'}${enc.patient_last_name?.[0] ?? '?'}`
                  return (
                    <div key={enc.id} className="px-3 py-2 text-sm">
                      <span className="font-semibold text-amber-300">{initials}</span>
                      <span className="text-gray-400 ml-2">{enc.chief_complaint || 'CC unknown'}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-gray-500">
              Status will be set to Closed. A PDF will be generated automatically.
            </p>

            {/* Section 8 Signature */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Section 8 — Leader Signature (required)
              </label>
              <div className="bg-white rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
                <SignatureCanvas
                  ref={closeoutSigRef}
                  penColor="black"
                  canvasProps={{ width: 400, height: 100, className: 'w-full', style: { touchAction: 'none', display: 'block' } }}
                  backgroundColor="white"
                />
              </div>
              <button type="button" onClick={() => closeoutSigRef.current?.clear()}
                className="text-xs text-gray-500 hover:text-red-400 mt-1 transition-colors">Clear signature</button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmCloseout}
                disabled={closingOut}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-bold transition-colors"
              >
                {closingOut ? 'Closing Out...' : 'Confirm Close Out'}
              </button>
              <button
                onClick={() => setShowCloseout(false)}
                disabled={closingOut}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
