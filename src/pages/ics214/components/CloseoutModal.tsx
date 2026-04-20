import { useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import type { ICS214Header, PatientEncounter } from './types'

interface Props {
  header: ICS214Header
  encounters: PatientEncounter[]
  closingOut: boolean
  onConfirm: (sigDataUrl: string | null) => void
  onCancel: () => void
}

export function CloseoutModal({ header, encounters, closingOut, onConfirm, onCancel }: Props) {
  const sigRef = useRef<SignatureCanvas>(null)

  const handleConfirm = () => {
    const sigDataUrl = (sigRef.current && !sigRef.current.isEmpty())
      ? sigRef.current.getTrimmedCanvas().toDataURL('image/png')
      : null
    onConfirm(sigDataUrl)
  }

  return (
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

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Section 8 — Leader Signature (required)
          </label>
          <div className="bg-white rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={sigRef}
              penColor="black"
              canvasProps={{ width: 400, height: 100, className: 'w-full', style: { touchAction: 'none', display: 'block' } }}
              backgroundColor="white"
            />
          </div>
          <button type="button" onClick={() => sigRef.current?.clear()}
            className="text-xs text-gray-500 hover:text-red-400 mt-1 transition-colors">Clear signature</button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={closingOut}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-bold transition-colors"
          >
            {closingOut ? 'Closing Out...' : 'Confirm Close Out'}
          </button>
          <button
            onClick={onCancel}
            disabled={closingOut}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
