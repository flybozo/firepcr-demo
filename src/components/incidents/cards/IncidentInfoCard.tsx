import { useState } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import * as incidentService from '@/lib/services/incidents'
import { EditField } from '@/components/shared/EditField'
import { LocationEditField } from '@/components/shared/LocationEditField'
import type { Incident } from '@/types/incident'

export function IncidentInfoCard({
  incident,
  activeIncidentId,
  isAdmin,
  isDefaultFire,
  toggleDefaultFire,
  onSaveField,
  reload,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  incident: Incident
  activeIncidentId: string
  isAdmin: boolean
  isDefaultFire: boolean
  toggleDefaultFire: () => void
  onSaveField: (key: string, val: string) => void
  reload: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const supabase = createClient()
  const [uploadingContract, setUploadingContract] = useState(false)

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingContract(true)
    const path = `contracts/${activeIncidentId}/${file.name}`
    const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingContract(false); return }
    await incidentService.updateIncident(activeIncidentId, {
      contract_url: data.path,
      contract_file_name: file.name,
    })
    setUploadingContract(false)
    reload()
  }

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
        {dragHandleProps && (
          <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
        )}
        {cycleSpan && (
          <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
            className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🔥 Incident Info</h3>
        <button
          onClick={toggleDefaultFire}
          title={isDefaultFire ? 'Remove as default fire' : 'Set as default fire'}
          className={`text-sm transition-colors shrink-0 ${
            isDefaultFire ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-yellow-400'
          }`}
        >
          {isDefaultFire ? '★' : '☆'}
        </button>
        {isAdmin && incident.status === 'Active'
          ? <span className="text-xs text-gray-600 italic">Click any field to edit</span>
          : incident.status !== 'Active'
            ? <span className="text-xs text-gray-600 italic">Closed — read only</span>
            : null}
      </div>

      <div className="px-3 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1">
          <div className="col-span-2 md:col-span-4">
            <EditField label="Name" value={incident.name} fieldKey="name" readOnly={!isAdmin} onSave={onSaveField} />
          </div>
          <div className="col-span-2">
            <LocationEditField
              value={incident.location}
              latitude={incident.latitude}
              longitude={incident.longitude}
              readOnly={!isAdmin}
              onSave={onSaveField}
              onSaveCoords={(lat, lng, label) => {
                onSaveField('location', label)
                onSaveField('latitude', String(lat))
                onSaveField('longitude', String(lng))
              }}
            />
          </div>
          <EditField label="Incident Number" value={incident.incident_number} fieldKey="incident_number" readOnly={!isAdmin} onSave={onSaveField} />
          <EditField label="Start Date" value={incident.start_date} fieldKey="start_date" type="date" readOnly={!isAdmin} onSave={onSaveField} />
          <EditField label="Agreement Number" value={incident.agreement_number} fieldKey="agreement_number" readOnly={!isAdmin} onSave={onSaveField} />
          <EditField label="Resource Order #" value={incident.resource_order_number} fieldKey="resource_order_number" readOnly={!isAdmin} onSave={onSaveField} />
          <EditField label="Financial Code" value={incident.financial_code} fieldKey="financial_code" readOnly={!isAdmin} onSave={onSaveField} />
          <EditField label="Status" value={incident.status} fieldKey="status" readOnly={!isAdmin} onSave={onSaveField}
            options={[{ label: 'Active', value: 'Active' }, { label: 'Closed', value: 'Closed' }]} />
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
          {[
            { label: 'Med Unit Leader', nameKey: 'med_unit_leader_name', emailKey: 'med_unit_leader_email', phoneKey: 'med_unit_leader_phone',
              name: incident.med_unit_leader_name, email: incident.med_unit_leader_email, phone: incident.med_unit_leader_phone },
            { label: 'Logs Contact', nameKey: 'logs_contact_name', emailKey: 'logs_contact_email', phoneKey: 'logs_contact_phone',
              name: incident.logs_contact_name, email: incident.logs_contact_email, phone: incident.logs_contact_phone },
            { label: 'Comp Claims', nameKey: 'comp_claims_name', emailKey: 'comp_claims_email', phoneKey: 'comp_claims_phone',
              name: incident.comp_claims_name, email: incident.comp_claims_email, phone: incident.comp_claims_phone },
            { label: 'Finance (OF-297)', nameKey: 'finance_contact_name', emailKey: 'finance_contact_email', phoneKey: 'finance_contact_phone',
              name: incident.finance_contact_name, email: incident.finance_contact_email, phone: incident.finance_contact_phone },
          ].map(contact => (
            <div key={contact.label} className="p-3 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{contact.label}</p>
                {(contact.email || contact.phone) && (
                  <div className="flex gap-1.5">
                    {contact.phone && (<>
                      <a href={`tel:${contact.phone}`} className="text-green-400 hover:text-green-300 text-xs" title="Call">📞</a>
                      <a href={`sms:${contact.phone}`} className="text-blue-400 hover:text-blue-300 text-xs" title="Text">💬</a>
                    </>)}
                    {contact.email && <a href={`mailto:${contact.email}`} className="text-yellow-400 hover:text-yellow-300 text-xs" title="Email">✉️</a>}
                  </div>
                )}
              </div>
              <EditField label="Name" value={contact.name as string | null} fieldKey={contact.nameKey} readOnly={!isAdmin} onSave={onSaveField} />
              <EditField label="Email" value={contact.email as string | null} fieldKey={contact.emailKey} type="email" readOnly={!isAdmin} onSave={onSaveField} />
              <EditField label="Phone" value={contact.phone as string | null} fieldKey={contact.phoneKey} type="tel" readOnly={!isAdmin} onSave={onSaveField} />
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="border-t border-gray-800 px-4 py-3 flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 shrink-0">Contract</p>
          {uploadingContract && <span className="text-xs text-gray-500 animate-pulse">Uploading...</span>}
          {incident.contract_url ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <a href={incident.contract_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 truncate">
                📄 {incident.contract_file_name || 'View Contract'}
              </a>
              <label className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer shrink-0">
                Replace
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleContractUpload} />
              </label>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
              <span className="text-xs text-gray-400">📎 Upload Contract PDF</span>
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleContractUpload} />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
