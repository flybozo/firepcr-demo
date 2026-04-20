
import type { FormState, Employee } from '../types'
import { inputCls, labelCls, sectionCls } from '../types'

interface ProviderSectionProps {
  form: FormState
  isCS: boolean
  isProviderMatch: boolean
  isSelfOrder: boolean
  dispensers: Employee[]
  providerEmployees: Employee[]
  witnessOptions: Employee[]
  providerPin: string
  witnessPin: string
  set: (field: keyof FormState, value: string) => void
  onProviderPinChange: (v: string) => void
  onWitnessPinChange: (v: string) => void
}

export function ProviderSection({
  form, isCS, isProviderMatch, isSelfOrder,
  dispensers, providerEmployees, witnessOptions,
  providerPin, witnessPin,
  set, onProviderPinChange, onWitnessPinChange,
}: ProviderSectionProps) {
  return (
    <>
      <p className={sectionCls}>Providers</p>
      <div>
        <label className={labelCls}>Administered By *</label>
        <select className={inputCls} value={form.dispensed_by} onChange={e => set('dispensed_by', e.target.value)}>
          <option value="">Select provider</option>
          {dispensers.map(emp => (
            <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Prescribing Provider (MD/DO/NP/PA)</label>
        <select className={inputCls} value={form.prescribing_provider} onChange={e => set('prescribing_provider', e.target.value)}>
          <option value="">Select (optional)</option>
          {providerEmployees.map(emp => (
            <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
          ))}
        </select>
      </div>

      {form.prescribing_provider && (
        <div className="border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Physician Order &amp; Signature</p>
          {isSelfOrder ? (
            <>
              <div className="bg-blue-950 border border-blue-700 rounded-lg p-3">
                <p className="text-blue-300 text-xs">
                  ℹ️ You are both dispensing and prescribing. You may sign now or this will appear in your Unsigned Orders queue.
                </p>
              </div>
              <div>
                <label className={labelCls}>Electronic Signature (PIN / Password) — Optional</label>
                <input
                  type="password"
                  value={providerPin}
                  onChange={e => onProviderPinChange(e.target.value)}
                  placeholder="Enter PIN to sign now (optional)"
                  className={inputCls}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Sign now to create a Provider Order. Leave blank to create a Verbal Order in your Unsigned queue.
                </p>
              </div>
            </>
          ) : isProviderMatch ? (
            <>
              <p className="text-xs text-green-400">✓ You are the prescribing provider. Please sign below to authorize this order.</p>
              <div>
                <label className={labelCls}>Electronic Signature (PIN / Password)</label>
                <input
                  type="password"
                  value={providerPin}
                  onChange={e => onProviderPinChange(e.target.value)}
                  placeholder="Enter your signing PIN or password (min 4 chars)"
                  className={inputCls}
                />
                <p className="text-xs text-gray-600 mt-1">
                  By entering your PIN you electronically attest this order is appropriate and within your scope.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-yellow-950 border border-yellow-700 rounded-lg p-3">
              <p className="text-yellow-300 text-xs">
                ⚠️ This order requires co-signature from <strong>{form.prescribing_provider}</strong>. They will be notified to sign.
              </p>
            </div>
          )}
        </div>
      )}

      {isCS && parseFloat(form.qty_wasted) > 0 && (
        <>
          <p className={sectionCls}>⚠️ CS Wastage Witness Required</p>
          <div>
            <label className={labelCls}>Waste Witness *</label>
            <select className={inputCls} value={form.waste_witness} onChange={e => set('waste_witness', e.target.value)}>
              <option value="">Select witness...</option>
              {witnessOptions.filter(w => w.name !== form.dispensed_by).map(w => (
                <option key={w.id} value={w.name}>{w.name} ({w.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Witness Electronic Signature *</label>
            <input
              type="password"
              value={witnessPin}
              onChange={e => onWitnessPinChange(e.target.value)}
              placeholder="Witness PIN or password"
              className={inputCls}
            />
            <p className="text-xs text-gray-600 mt-1">Witness attests to observing the wastage.</p>
          </div>
        </>
      )}
    </>
  )
}
