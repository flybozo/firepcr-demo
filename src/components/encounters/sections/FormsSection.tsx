import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Encounter, ConsentForm, CompClaim } from '@/types/encounters'

export function FormsSection({
  enc,
  isLocked,
  consentForms,
  compClaims,
  formPdfUrls,
}: {
  enc: Encounter
  isLocked: boolean
  consentForms: ConsentForm[]
  compClaims: CompClaim[]
  formPdfUrls: Record<string, string>
}) {
  const [showForms, setShowForms] = useState(true)

  return (
    <div className="theme-card rounded-xl border overflow-hidden h-full">
      <div className="flex items-center px-4 pr-10 py-3">
        <button onClick={() => setShowForms(v => !v)} className="flex items-center gap-2 text-left flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            📋 Forms & Documents
            {(consentForms.length + compClaims.length) > 0 && <span className="ml-2 text-gray-600 normal-case font-normal">({consentForms.length + compClaims.length})</span>}
          </span>
          <span className="text-gray-500 text-xs">{showForms ? '▲' : '▼'}</span>
        </button>
      </div>
      {showForms && (
        <div className="px-4 pb-4">
          {(consentForms.length > 0 || compClaims.length > 0) ? (
            <div className="space-y-2">
              {consentForms.map(cf => (
                <div key={cf.id} className="flex flex-wrap items-center gap-2 text-xs border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-500 whitespace-nowrap">
                    {cf.date_time ? new Date(cf.date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(cf.date_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${cf.consent_type === 'Consent to Treat' ? 'bg-blue-900 text-blue-300' : 'bg-red-900 text-red-300'}`}>
                    {cf.consent_type === 'Consent to Treat' ? 'Consent' : 'AMA'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${cf.signed ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {cf.signed ? 'Signed' : 'Unsigned'}
                  </span>
                  <span className="text-gray-400 truncate">{cf.provider_of_record || ''}</span>
                  <span className="ml-auto shrink-0">
                    {formPdfUrls[cf.id] ? (
                      <a href={formPdfUrls[cf.id]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 whitespace-nowrap">📄 PDF</a>
                    ) : cf.pdf_url ? (
                      <span className="text-gray-500 italic">PDF</span>
                    ) : null}
                  </span>
                </div>
              ))}
              {compClaims.map((cc: any) => (
                <div key={cc.id} className="flex flex-wrap items-center gap-2 text-xs border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-500 whitespace-nowrap">
                    {cc.created_at ? new Date(cc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(cc.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-900 text-orange-300">CC</span>
                  <span className={`px-2 py-0.5 rounded-full ${cc.status === 'Complete' ? 'bg-green-900 text-green-300' : cc.status === 'Filed' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
                    {cc.status || 'Pending'}
                  </span>
                  <span className="text-gray-400 truncate">{cc.provider_name || ''}</span>
                  <span className="ml-auto shrink-0">
                    {formPdfUrls[cc.id] ? (
                      <a href={cc.id && formPdfUrls[cc.id] ? formPdfUrls[cc.id] : '#'} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 whitespace-nowrap">📄 PDF</a>
                    ) : cc.pdf_url ? (
                      <span className="text-gray-500 italic">PDF</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No forms yet.</p>
          )}
        </div>
      )}
      {!isLocked && (
        <div className="flex gap-1.5 px-4 py-2.5 border-t border-gray-800">
          <Link to={`/consent/treat?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&firstName=${encodeURIComponent(enc.patient_first_name||'')}&lastName=${encodeURIComponent(enc.patient_last_name||'')}`}
            className="text-[11px] leading-tight px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors">
            + Consent
          </Link>
          <Link to={`/consent/ama?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}`}
            className="text-[11px] leading-tight px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors">
            + AMA
          </Link>
          <Link to={`/comp-claims/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&tebw=${encodeURIComponent(enc.time_employee_began_work || (enc.date ? enc.date + "T06:00" : ""))}${enc.incident_id ? '&incidentId=' + enc.incident_id : ''}`}
            className="text-[11px] leading-tight px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-white font-semibold transition-colors">
            + CC
          </Link>
        </div>
      )}
    </div>
  )
}
