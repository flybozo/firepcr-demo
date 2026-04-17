/**
 * PinSignature — PIN-based digital signature modal
 *
 * For the logged-in user signing their own action:
 *   <PinSignature
 *     label="Sign as Provider"
 *     employeeId={currentUser.employee.id}
 *     employeeName={currentUser.employee.name}
 *     onSign={(record) => handleSign(record)}
 *     onCancel={() => setShowSig(false)}
 *   />
 *
 * For a witness signing (different employee, same device):
 *   <PinSignature
 *     label="Witness Signature"
 *     mode="witness"
 *     onSign={(record) => handleWitnessSign(record)}
 *     onCancel={() => setShowWitness(false)}
 *   />
 *
 * SignatureRecord returned in onSign:
 *   {
 *     employeeId: string
 *     employeeName: string
 *     signedAt: string        // ISO timestamp
 *     signatureHash: string   // SHA-256(employeeId + documentContext + timestamp + pin)
 *     displayText: string     // Human-readable: "Aaron Stutz — digitally signed 4/13/2026 5:44 PM"
 *   }
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/authFetch'

export type SignatureRecord = {
  employeeId: string
  employeeName: string
  signedAt: string
  signatureHash: string
  displayText: string
}

type Props = {
  label?: string
  mode?: 'self' | 'witness'    // self = logged-in user; witness = any employee on device
  employeeId?: string          // required for mode=self
  employeeName?: string        // required for mode=self
  documentContext?: string     // optional: document ID or type for the hash
  onSign: (record: SignatureRecord) => void
  onCancel: () => void
  onNoPinSet?: () => void      // called when mode=self user has no PIN — lets parent show custom UI
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function PinSignature({
  label = 'Sign',
  mode = 'self',
  employeeId,
  employeeName,
  documentContext = '',
  onSign,
  onCancel,
  onNoPinSet,
}: Props) {
  const [noPinAlert, setNoPinAlert] = useState(false)
  const supabase = createClient()
  const [pin, setPin] = useState('')
  const [witnessSearch, setWitnessSearch] = useState('')
  const [witnessEmployee, setWitnessEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; role: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Witness token — fetched server-side when witness employee is selected
  const [witnessToken, setWitnessToken] = useState<string | null>(null)
  const [fetchingToken, setFetchingToken] = useState(false)

  const handleWitnessSearch = async (q: string) => {
    setWitnessSearch(q)
    setWitnessEmployee(null)
    setWitnessToken(null)
    if (q.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('employees')
      .select('id, name, role')
      .ilike('name', `%${q}%`)
      .eq('status', 'Active')
      .limit(6)
    setSearchResults(data || [])
  }

  const handleWitnessSelect = async (emp: { id: string; name: string; role: string }) => {
    setWitnessEmployee(emp)
    setSearchResults([])
    setWitnessToken(null)
    setFetchingToken(true)
    try {
      const res = await authFetch('/api/pin/witness-token', {
        method: 'POST',
        body: JSON.stringify({ document_context: documentContext }),
      })
      const data = await res.json()
      if (res.ok && data.witness_token) {
        setWitnessToken(data.witness_token)
      } else {
        setError('Could not start witness session. Please try again.')
        setWitnessEmployee(null)
      }
    } catch {
      setError('Network error starting witness session. Please try again.')
      setWitnessEmployee(null)
    }
    setFetchingToken(false)
  }

  const handleSubmit = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }

    const targetId = mode === 'witness' ? witnessEmployee?.id : employeeId
    const targetName = mode === 'witness' ? witnessEmployee?.name : employeeName

    if (!targetId || !targetName) {
      setError(mode === 'witness' ? 'Select an employee first' : 'Employee not identified')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Server-side PIN verification (bcrypt)
      // For witness mode, include the short-lived witness token (required by server)
      const verifyBody: Record<string, string> = {
        pin,
        employee_id: targetId,
        document_context: documentContext,
      }
      if (mode === 'witness' && witnessToken) {
        verifyBody.witness_token = witnessToken
      }
      const verifyRes = await authFetch('/api/pin/verify', {
        method: 'POST',
        body: JSON.stringify(verifyBody),
      })
      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        // Witness token expired or invalid — reset so they can re-select the witness
        if (verifyData.code === 'token_expired' || verifyData.code === 'token_already_used' || verifyData.code === 'witness_token_required') {
          setWitnessToken(null)
          setError('Signing session expired. Please re-select the witness to start a new session.')
        } else {
          setError(verifyData.error || 'Verification failed')
        }
        setLoading(false)
        return
      }

      if (!verifyData.valid) {
        if (verifyData.reason === 'no_pin_set') {
          setLoading(false)
          if (mode === 'self') {
            setNoPinAlert(true)
          } else {
            setError(`${verifyData.employeeName || 'This employee'} hasn't set a signing PIN yet.`)
          }
          return
        }
        setError('Incorrect PIN. Try again.')
        setPin('')
        setLoading(false)
        return
      }

      // PIN verified server-side — use the signature data from server
      onSign({
        employeeId: targetId,
        employeeName: targetName!,
        signedAt: verifyData.signedAt,
        signatureHash: verifyData.signatureHash,
        displayText: verifyData.displayText,
      })
    } catch (err: any) {
      setError(err.message || 'Signature failed')
      setLoading(false)
    }
  }

  const navigate = useNavigate()
  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-red-500'

  // No PIN set — show profile prompt instead of PIN entry
  if (noPinAlert) {
    const isSelf = mode === 'self'
    const whoName = isSelf ? (employeeName || 'You') : (witnessEmployee?.name || 'This employee')
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
        <div className="bg-gray-900 border border-orange-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-2">🔓</div>
            <h3 className="font-bold text-white text-lg">No Signing PIN Set</h3>
            <p className="text-gray-400 text-sm mt-2">
              {isSelf
                ? 'You need to set a signing PIN before you can digitally sign documents.'
                : <><strong className="text-white">{whoName}</strong> hasn't set a signing PIN yet and can't witness until they do.</>
              }
            </p>
          </div>
          <div className="bg-orange-900/30 border border-orange-700/50 rounded-xl p-3 space-y-1">
            {isSelf ? (
              <p className="text-orange-300 text-sm text-center">
                Go to <strong>My Profile → Signing PIN</strong> to set yours up.
              </p>
            ) : (
              <>
                <p className="text-orange-300 text-sm text-center">
                  Ask <strong>{whoName}</strong> to log in and go to:
                </p>
                <p className="text-white text-sm text-center font-medium">
                  Profile → Signing PIN
                </p>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { onNoPinSet ? onNoPinSet() : onCancel() }}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors">
              {isSelf ? 'Cancel' : 'Choose Different Witness'}
            </button>
            {isSelf && (
              <button
                onClick={() => {
                  onNoPinSet ? onNoPinSet() : onCancel()
                  navigate('/profile')
                }}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 rounded-xl text-sm font-bold transition-colors">
                Go to Profile
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-2xl mb-1">🔐</div>
          <h3 className="font-bold text-white text-lg">{label}</h3>
          {mode === 'self' && employeeName && (
            <p className="text-gray-400 text-sm mt-1">{employeeName}</p>
          )}
        </div>

        {/* Witness employee lookup */}
        {mode === 'witness' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Witness Employee</label>
            {witnessEmployee ? (
              <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white font-medium text-sm">{witnessEmployee.name}</p>
                  <p className="text-gray-500 text-xs">
                    {witnessEmployee.role}
                    {fetchingToken && <span className="ml-2 text-yellow-400">⏳ Starting session…</span>}
                    {!fetchingToken && witnessToken && <span className="ml-2 text-green-400">✅ Ready</span>}
                  </p>
                </div>
                <button onClick={() => { setWitnessEmployee(null); setWitnessSearch(''); setWitnessToken(null) }}
                  className="text-gray-500 hover:text-white text-xs">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={witnessSearch}
                  onChange={e => handleWitnessSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-10">
                    {searchResults.map(emp => (
                      <button key={emp.id} type="button"
                        onClick={() => handleWitnessSelect(emp)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 transition-colors">
                        <span className="text-white">{emp.name}</span>
                        <span className="text-gray-500 ml-2 text-xs">{emp.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PIN entry */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">
            {mode === 'witness' ? 'Witness PIN' : 'Your Signing PIN'}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="● ● ● ●"
            autoFocus
            className={inputClass}
          />
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || fetchingToken || pin.length < 4 || (mode === 'witness' && !witnessEmployee) || (mode === 'witness' && !witnessToken)}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-sm font-bold transition-colors">
            {loading ? 'Verifying…' : fetchingToken ? 'Starting…' : 'Sign'}
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center">
          PIN-verified digital signature · {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}
