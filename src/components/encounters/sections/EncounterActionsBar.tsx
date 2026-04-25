import { Link } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import type { Encounter } from '@/types/encounters'

export function EncounterActionsBar({
  enc,
  isLocked,
  canMedicate,
}: {
  enc: Encounter
  isLocked: boolean
  canMedicate: boolean
}) {
  const supabase = createClient()

  return (
    <div className="theme-card rounded-xl border overflow-hidden h-full">
      <div className="px-4 py-2.5 theme-card-header border-b">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Chart Actions</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3">
        <Link to={`/consent/treat?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&firstName=${encodeURIComponent(enc.patient_first_name||'')}&lastName=${encodeURIComponent(enc.patient_last_name||'')}`}
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
          <span>📝</span> Consent to Treat
        </Link>
        <Link to={`/consent/ama?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&firstName=${encodeURIComponent(enc.patient_first_name||'')}&lastName=${encodeURIComponent(enc.patient_last_name||'')}`}
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
          <span>✍️</span> AMA / Refusal
        </Link>
        {canMedicate && (
          <Link to={`/mar/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&patientName=${encodeURIComponent(((enc.patient_first_name||'')+' '+(enc.patient_last_name||'')).trim())}&dob=${encodeURIComponent(enc.patient_dob||'')}`}
            className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
            <span>💊</span> Log Medication
          </Link>
        )}
        {canMedicate && (
          <Link to={`/encounters/procedures/new?encounterId=${enc.encounter_id}`}
            className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
            <span>🩺</span> Add Procedure
          </Link>
        )}
        <Link to={`/encounters/photos/new?encounterId=${enc.encounter_id}`}
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
          <span>📷</span> Add Photo
        </Link>
        <Link to={`/comp-claims/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&tebw=${encodeURIComponent(enc.time_employee_began_work || (enc.date ? enc.date + "T06:00" : ""))}${enc.incident_id ? '&incidentId=' + enc.incident_id : ''}`}
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
          <span>📋</span> Comp Claim
        </Link>
        {!isLocked && (
          <Link to={`/encounters/${enc.id}/edit`}
            className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
            <span>✏️</span> Edit
          </Link>
        )}
        {!isLocked && enc.unit?.toUpperCase().startsWith('RAMBO') && (
          <>
            <button
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession()
                const resp = await fetch(`/api/encounters/${enc.id}/nemsis-export`, {
                  headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                })
                if (!resp.ok) { toast.error('XML export failed'); return }
                const blob = await resp.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `${enc.encounter_id || enc.id}-NEMSIS.xml`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-2 px-3 py-2.5 bg-blue-900 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors text-blue-200">
              <span>📤</span> Re-export XML
            </button>
            {(enc as any).nemsis_xml_url && (
              <button
                onClick={async () => {
                  const { data } = await supabase.storage.from('documents').createSignedUrl((enc as any).nemsis_xml_url, 3600)
                  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                }}
                className="flex items-center gap-2 px-3 py-2.5 bg-green-900 hover:bg-green-800 rounded-lg text-sm font-medium transition-colors text-green-200">
                <span>✅</span> Stored XML
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
