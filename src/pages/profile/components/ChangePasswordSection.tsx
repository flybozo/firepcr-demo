import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

export function ChangePasswordSection() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
    } else {
      toast.success('Password updated successfully')
      setPassword('')
      setConfirm('')
      setOpen(false)
    }
    setSaving(false)
  }

  return (
    <div className="theme-card rounded-2xl border p-5 space-y-4 mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Change Password</h2>
        </div>
        <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Confirm New Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || password.length < 8}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl text-sm transition-colors"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      )}
    </div>
  )
}
