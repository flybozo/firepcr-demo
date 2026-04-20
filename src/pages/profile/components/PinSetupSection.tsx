import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'

export function PinSetupSection({ employeeId }: { employeeId: string | undefined }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [hasPin, setHasPin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!employeeId) return
    authFetch('/api/pin/status')
      .then(r => r.json())
      .then(data => setHasPin(!!data?.hasPin))
      .catch(() => setHasPin(null))
  }, [employeeId])

  const handleSave = async () => {
    setError(''); setSuccess('')
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== confirm) { setError('PINs do not match'); return }
    if (!/^\d+$/.test(pin)) { setError('PIN must contain digits only'); return }
    if (!employeeId) { setError('No employee record'); return }
    setSaving(true)
    try {
      const setRes = await authFetch('/api/pin/set', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      })
      const setData = await setRes.json()
      if (!setRes.ok) throw new Error(setData.error || 'Failed to set PIN')
      setSuccess('Signing PIN saved successfully.')
      setHasPin(true)
      setPin(''); setConfirm('')
    } catch (e: any) {
      setError(e.message || 'Failed to save PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="theme-card rounded-2xl border p-5 space-y-4 mt-2">
      <div>
        <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Signing PIN</h2>
        <p className="text-xs text-gray-500 mt-1">
          {hasPin ? 'You have a signing PIN set. Enter a new one below to change it.' : 'Set a PIN to digitally sign CS transfers, daily counts, MAR co-signatures, and other actions.'}
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400">New PIN (4–8 digits)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="● ● ● ●"
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-center text-xl tracking-widest focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={confirm}
            onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}
            placeholder="● ● ● ●"
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-center text-xl tracking-widest focus:outline-none focus:border-red-500"
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {success && <p className="text-green-400 text-xs">{success}</p>}
        <button onClick={handleSave} disabled={saving || pin.length < 4}
          className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl text-sm transition-colors">
          {saving ? 'Saving...' : hasPin ? 'Update Signing PIN' : 'Set Signing PIN'}
        </button>
      </div>
    </div>
  )
}
