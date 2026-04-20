import { type ChangeEvent, type RefObject } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { PROVIDERS } from './AMAConstants'

interface Props {
  label: string
  sigRef: RefObject<SignatureCanvas | null>
  formDate: string
  formTime: string
  providerValue?: string
  onProviderChange?: (e: ChangeEvent<HTMLSelectElement>) => void
}

export function AMASignatureSection({
  label,
  sigRef,
  formDate,
  formTime,
  providerValue,
  onProviderChange,
}: Props) {
  return (
    <section className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">{label} *</h2>
      {onProviderChange !== undefined && (
        <div>
          <label className="text-xs text-gray-400">Provider of Record *</label>
          <select name="provider_of_record" value={providerValue} onChange={onProviderChange}
            className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Select provider...</option>
            {PROVIDERS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      )}
      <p className="text-xs text-gray-500">{formDate} {formTime}</p>
      <div
        className="bg-white rounded-lg overflow-hidden"
        style={{ touchAction: 'none' }}
        ref={(el) => {
          if (el) {
            const canvas = el.querySelector('canvas')
            if (canvas) {
              const rect = el.getBoundingClientRect()
              if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                canvas.width = Math.round(rect.width)
                canvas.height = 140
              }
            }
          }
        }}
      >
        <SignatureCanvas
          ref={sigRef}
          backgroundColor="white"
          penColor="black"
          canvasProps={{ style: { width: '100%', height: '140px', display: 'block' } }}
          onBegin={() => {
            const canvas = sigRef.current?.getCanvas()
            if (canvas) {
              const rect = canvas.getBoundingClientRect()
              if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                const data = sigRef.current?.toData()
                canvas.width = Math.round(rect.width)
                canvas.height = 140
                if (data) sigRef.current?.fromData(data)
              }
            }
          }}
        />
      </div>
      <button type="button" onClick={() => sigRef.current?.clear()}
        className="text-xs text-gray-500 underline">Clear</button>
    </section>
  )
}
