import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateEmployee } from '@/lib/services/employees'

const CERT_TYPE_OPTIONS = [
  'BLS/CPR', 'ACLS', 'PALS', 'ITLS / PHTLS / ATLS',
  'Paramedic License', 'Medical License', 'NP License', 'PA License', 'RN License',
  'Ambulance Driver Cert', 'NREMT', 'EMT Certification',
  'S-130', 'S-190', 'L-180',
  'ICS-100', 'ICS-200', 'ICS-300', 'ICS-400', 'ICS-700', 'ICS-800',
  'IRATI Level 1', 'Rope Rescue Technician', 'Swiftwater Rescue',
  'Annual Refresher (RT-130)', 'REMS Certification',
  'Other (describe in filename)',
]

const CERT_CODES: Record<string, string> = {
  'BLS/CPR': 'BLS', 'BLS': 'BLS', 'NREMT': 'NREMT', 'ACLS': 'ACLS',
  'PALS': 'PALS', 'ITLS': 'ITLS', 'ATLS': 'ATLS', 'PHTLS': 'PHTLS',
  'EMT Certification': 'EMT', 'Paramedic License': 'MEDIC',
  'Medical License': 'LICENSE', 'RN License': 'LICENSE', 'NP License': 'LICENSE',
  'Ambulance Driver Cert': 'ADC', 'DEA License': 'DEA',
  'S-130': 'S130', 'S-190': 'S190', 'L-180': 'L180',
  'ICS-100': 'ICS100', 'ICS-200': 'ICS200', 'ICS-700': 'ICS700', 'ICS-800': 'ICS800',
  'Red Card': 'REDCARD', 'SSV LEMSA': 'SSV-LEMSA',
}

function buildCanonicalName(ramId: string, certType: string, empName: string, expiry: string | null, ext: string) {
  const code = CERT_CODES[certType] || certType.toUpperCase().replace(/[^A-Z0-9-]/g, '-').slice(0, 20)
  const parts = empName.replace(/,/g, '').split(' ').filter(p => !['MD','DO','RN','NP','PA','FP-C'].includes(p))
  const nameShort = parts.length >= 2 ? `${parts[parts.length - 1]}-${parts[0][0]}` : parts[0] || 'Unknown'
  const dateStr = expiry ? `_exp${expiry.slice(0, 7)}` : ''
  return `${ramId}_${code}_${nameShort}${dateStr}${ext}`
}

interface Props {
  employee: any
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
  onReload: () => void
}

export function CredentialUpload({ employee, onSuccess, onError, onReload }: Props) {
  const supabase = createClient()
  const credRef = useRef<HTMLInputElement>(null)
  const [showCredUpload, setShowCredUpload] = useState(false)
  const [selectedCredType, setSelectedCredType] = useState('')
  const [credExpiry, setCredExpiry] = useState('')
  const [uploadingCred, setUploadingCred] = useState(false)

  const handleCredUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !employee?.id) return
    setUploadingCred(true); onError('')

    const rawExt = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
    let origExt = rawExt ? `.${rawExt}` : ''
    if (!origExt || origExt === '.txt') {
      if (file.type === 'application/pdf') origExt = '.pdf'
      else if (file.type === 'image/jpeg') origExt = '.jpg'
      else if (file.type === 'image/png') origExt = '.png'
      else if (file.type === 'image/heic') origExt = '.heic'
      else origExt = '.pdf'
    }
    const ramId = `RAM-${employee.id.slice(-3).toUpperCase()}`
    const certType = selectedCredType || 'Document'
    const canonicalName = buildCanonicalName(ramId, certType, employee.name || 'Unknown', credExpiry || null, origExt)

    const path = `${employee.id}/${canonicalName}`
    const mimeFromExt: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.heic': 'image/heic',
      '.webp': 'image/webp',
    }
    const contentType = file.type && file.type !== 'application/octet-stream' && file.type !== 'text/plain'
      ? file.type
      : (mimeFromExt[origExt] || 'application/pdf')
    const { error: upErr } = await supabase.storage.from('credentials').upload(path, file, { upsert: false, contentType })
    if (upErr) { onError('Upload failed: ' + upErr.message); setUploadingCred(false); return }

    const fileUrl = path
    await supabase.from('employee_credentials').insert({
      employee_id: employee.id,
      cert_type: certType,
      file_name: canonicalName,
      file_url: fileUrl,
      expiration_date: credExpiry || null,
    })

    const fieldMap: Record<string, string> = {
      'BLS/CPR': 'bls', 'BLS': 'bls', 'NREMT': 'bls', 'ACLS': 'acls', 'PALS': 'pals',
      'ITLS': 'itls', 'PHTLS': 'itls', 'ATLS': 'itls',
      'EMT Certification': 'ambulance_driver_cert', 'Ambulance Driver Cert': 'ambulance_driver_cert',
      'Paramedic License': 'paramedic_license', 'Medical License': 'medical_license',
      'S-130': 's130', 'S-190': 's190', 'L-180': 'l180',
      'ICS-100': 'ics100', 'ICS-200': 'ics200', 'ICS-700': 'ics700', 'ICS-800': 'ics800',
      'DEA License': 'dea_license', 'SSV LEMSA': 'ssv_lemsa',
    }
    const empField = fieldMap[certType]
    if (empField) {
      const val = credExpiry ? `✅ On file (exp ${credExpiry.slice(0,7)})` : '✅ On file'
      if (empField) await updateEmployee(employee.id, { [empField]: val })
    }

    onSuccess(`✅ ${certType} uploaded as ${canonicalName}`)
    onReload()
    setShowCredUpload(false)
    setSelectedCredType('')
    setCredExpiry('')
    setUploadingCred(false)
  }

  return (
    <div className="theme-card rounded-xl p-4 border mb-4 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Upload Credentials</h2>
      <p className="text-xs text-gray-500">Upload photos or PDFs of your certifications. You'll be asked what type of credential you're uploading.</p>

      {!showCredUpload ? (
        <button onClick={() => setShowCredUpload(true)}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">
          📎 Upload Credential Document
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Credential Type *</label>
            <select value={selectedCredType} onChange={e => setSelectedCredType(e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">Select credential type...</option>
              {CERT_TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {selectedCredType && (
            <>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Expiration Date (optional)</label>
                <input type="date" value={credExpiry} onChange={e => setCredExpiry(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <button onClick={() => credRef.current?.click()}
                disabled={uploadingCred}
                className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                {uploadingCred ? 'Uploading...' : `📎 Select file for: ${selectedCredType}`}
              </button>
              <p className="text-xs text-gray-600 text-center">Will be saved as: {selectedCredType.toUpperCase().replace(/[^A-Z0-9]/g,"-")}_[YourName]{credExpiry ? `_exp${credExpiry.slice(0,7)}` : ""}.pdf</p>
              <input ref={credRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden" onChange={handleCredUpload} />
            </>
          )}
          <button onClick={() => { setShowCredUpload(false); setSelectedCredType('') }}
            className="w-full py-1.5 bg-gray-800 rounded-lg text-xs text-gray-400 hover:text-gray-200">
            Cancel
          </button>
        </div>
      )}
      <p className="text-xs text-gray-500">PDF, JPG, or PNG · Max 50MB per file</p>
    </div>
  )
}
