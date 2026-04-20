import { useState } from 'react'
import { LoadingSkeleton } from '@/components/ui'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { generate214PDF } from '@/lib/generate214pdf'
import type { Activity, PatientEncounter } from './components/types'
import { useICS214Data } from './components/useICS214Data'
import { HeaderCard } from './components/HeaderCard'
import { PersonnelSection } from './components/PersonnelSection'
import { ActivityLog } from './components/ActivityLog'
import { CloseoutModal } from './components/CloseoutModal'
import { PDFSection } from './components/PDFSection'

export default function ICS214DetailPage() {
  const params = useParams()
  const ics214IdParam = params.id as string
  const assignment = useUserAssignment()

  const { supabase, header, setHeader, activities, setActivities, personnel, loading, load, saveField, addActivity, addPersonnel } =
    useICS214Data(ics214IdParam, assignment)

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
      ics214_id: ics214IdParam,
      log_datetime: new Date().toISOString(),
      description: `PATIENT CONTACT — ${enc.patient_first_name?.[0] ?? '?'}${enc.patient_last_name?.[0] ?? '?'} | CC: ${enc.chief_complaint || 'Unknown'} | Disposition: ${enc.disposition || 'Unknown'} | PCR: ${enc.encounter_id || enc.id}`,
      logged_by: loggedBy,
      activity_type: 'patient_contact' as const,
    }))

    if (patientActivities.length > 0) {
      await supabase.from('ics214_activities').insert(patientActivities)
    }

    let sigStoragePath: string | null = null
    if (sigDataUrl) {
      const sigBlob = await (await fetch(sigDataUrl)).blob()
      const sigPath = `ics214/${ics214IdParam}-leader-sig.png`
      const { error: sigErr } = await supabase.storage.from('signatures').upload(sigPath, sigBlob, { contentType: 'image/png', upsert: true })
      if (!sigErr) sigStoragePath = sigPath
    }

    await supabase.from('ics214_headers').update({
      status: 'Closed',
      closed_at: new Date().toISOString(),
      closed_by: loggedBy,
      leader_signature_url: sigStoragePath,
    } as any).eq('ics214_id', ics214IdParam)

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
        .from('ics214_activities').select('*').eq('ics214_id', ics214IdParam).order('log_datetime')

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
      await supabase.from('ics214_headers').update({ pdf_url: path, pdf_file_name: `${header.ics214_id}.pdf` }).eq('ics214_id', ics214IdParam)
      setHeader(prev => prev ? { ...prev, pdf_url: path, pdf_file_name: `${header.ics214_id}.pdf` } : prev)
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
      if (signed?.signedUrl) setSignedPdfUrl(signed.signedUrl)
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
    setGeneratingPDF(false)
  }

  if (loading) return <LoadingSkeleton fullPage />

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
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
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
          <HeaderCard header={header} onSave={saveField} />
          <PersonnelSection personnel={personnel} onAdd={addPersonnel} />
          <ActivityLog activities={activities} header={header} ics214IdParam={ics214IdParam} onAddActivity={addActivity} />
          {header.status === 'Open' && (
            <button onClick={openCloseout} className="w-full py-3 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-bold transition-colors border border-red-600">
              🔒 Close Out ICS 214
            </button>
          )}
          {header.status === 'Closed' && (
            <PDFSection header={header} signedPdfUrl={signedPdfUrl} generatingPDF={generatingPDF} onRegenerate={() => generateAndUploadPDF()} />
          )}
        </div>
      </div>
      {showCloseout && (
        <CloseoutModal header={header} encounters={encounters} closingOut={closingOut} onConfirm={confirmCloseout} onCancel={() => setShowCloseout(false)} />
      )}
    </div>
  )
}
